use std::collections::HashSet;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Argument, Expression, FormalParameterKind, FormalParameters, FunctionBody,
    ImportOrExportKind, Statement, VariableDeclarationKind,
};
use oxc_ast::{AstBuilder, NONE};
use oxc_codegen::{Codegen, CodegenOptions, CommentOptions};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::{SourceType, SPAN};
use oxc_traverse::{traverse_mut, Traverse, TraverseCtx};

use super::helpers::select_sourcetype_based_on_enum::select_sourcetype_based_on_enum;
use super::transformer_impl::TraverseState;

const WRAP_HOOK_NAME: &str = "__zen_wrapMethodCallResult";
const INSTRUMENT_IMPORT_SOURCE: &str = "@aikidosec/firewall/instrument/internals";

/// Methods to wrap with taint tracking in user code.
const METHODS_TO_WRAP: &[&str] = &[
    // String methods that transform content
    "replace",
    "replaceAll",
    "slice",
    "substring",
    "substr",
    "trim",
    "trimStart",
    "trimEnd",
    "trimLeft",
    "trimRight",
    "toLowerCase",
    "toUpperCase",
    "toLocaleLowerCase",
    "toLocaleUpperCase",
    "normalize",
    "repeat",
    "padStart",
    "padEnd",
    "concat",
    "split",
    "charAt",
    "at",
    // Array methods (for chains like .split('').reverse().join(''))
    "join",
    "reverse",
];

/// Entry point: transform user code to wrap method calls with taint tracking.
pub fn transform_user_code_str(code: &str, src_type: &str) -> Result<String, String> {
    let allocator = Allocator::default();

    // Don't double-transform
    if code.contains(WRAP_HOOK_NAME) {
        return Err("Code already contains taint tracking hook".to_string());
    }

    let source_type = select_sourcetype_based_on_enum(src_type);

    let mut parser_result = Parser::new(&allocator, code, source_type).parse();

    if parser_result.panicked || !parser_result.errors.is_empty() {
        return Err(format!(
            "Error while parsing code: {:?}",
            parser_result.errors
        ));
    }

    let program = &mut parser_result.program;

    let semantic = SemanticBuilder::new().build(program);

    if !semantic.errors.is_empty() {
        return Err(format!(
            "Error during semantic analysis: {:?}",
            semantic.errors
        ));
    }

    let (scopes, _nodes) = semantic.semantic.into_scoping_and_nodes();

    let ast_builder = AstBuilder::new(&allocator);

    let t = &mut UserCodeTransformer::new(&allocator, &ast_builder);
    let state = TraverseState {};

    traverse_mut(t, &allocator, program, scopes, state);

    if !t.has_transforms {
        // No method calls found to wrap - return original code unchanged
        return Ok(code.to_string());
    }

    // Insert import for __zen_wrapMethodCallResult
    insert_wrap_hook_import(
        &source_type,
        parser_result.module_record.has_module_syntax,
        &allocator,
        &ast_builder,
        &mut program.body,
    );

    let js = Codegen::new()
        .with_options(CodegenOptions {
            comments: CommentOptions {
                normal: true,
                jsdoc: true,
                annotation: true,
                legal: oxc_codegen::LegalComment::Inline,
            },
            minify: false,
            ..CodegenOptions::default()
        })
        .build(program);

    Ok(js.code)
}

fn is_common_js(source_type: &SourceType, has_module_syntax: bool) -> bool {
    if source_type.is_commonjs() {
        return true;
    }
    if source_type.is_unambiguous() && !has_module_syntax {
        return true;
    }
    false
}

fn insert_wrap_hook_import<'a>(
    source_type: &SourceType,
    has_module_syntax: bool,
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    body: &mut oxc_allocator::Vec<'a, Statement<'a>>,
) {
    if is_common_js(source_type, has_module_syntax) {
        // const { __zen_wrapMethodCallResult } = require("@aikidosec/firewall/instrument/internals");
        let mut require_args = builder.vec_with_capacity(1);
        require_args.push(Argument::StringLiteral(builder.alloc_string_literal(
            SPAN,
            allocator.alloc_str(INSTRUMENT_IMPORT_SOURCE),
            None,
        )));

        let mut binding_properties = builder.vec_with_capacity(1);
        binding_properties.push(builder.binding_property(
            SPAN,
            builder.property_key_static_identifier(SPAN, WRAP_HOOK_NAME),
            builder.binding_pattern_binding_identifier(SPAN, WRAP_HOOK_NAME),
            true,
            false,
        ));

        let mut declarations = builder.vec_with_capacity(1);
        declarations.push(builder.variable_declarator(
            SPAN,
            VariableDeclarationKind::Const,
            builder.binding_pattern_object_pattern(SPAN, binding_properties, NONE),
            NONE,
            Some(builder.expression_call(
                SPAN,
                builder.expression_identifier(SPAN, "require"),
                NONE,
                require_args,
                false,
            )),
            false,
        ));

        let var_declaration = Statement::VariableDeclaration(builder.alloc_variable_declaration(
            SPAN,
            VariableDeclarationKind::Const,
            declarations,
            false,
        ));

        body.insert(0, var_declaration);
        return;
    }

    // ESM: import { __zen_wrapMethodCallResult } from "@aikidosec/firewall/instrument/internals";
    let mut specifiers = builder.vec_with_capacity(1);
    specifiers.push(
        builder.import_declaration_specifier_import_specifier(
            SPAN,
            builder.module_export_name_identifier_name(SPAN, WRAP_HOOK_NAME),
            builder.binding_identifier(SPAN, WRAP_HOOK_NAME),
            ImportOrExportKind::Value,
        ),
    );

    let import_stmt = Statement::ImportDeclaration(builder.alloc_import_declaration(
        SPAN,
        Some(specifiers),
        builder.string_literal(SPAN, allocator.alloc_str(INSTRUMENT_IMPORT_SOURCE), None),
        None,
        NONE,
        ImportOrExportKind::Value,
    ));

    body.insert(0, import_stmt);
}

pub struct UserCodeTransformer<'a> {
    pub allocator: &'a Allocator,
    pub ast_builder: &'a AstBuilder<'a>,
    methods: HashSet<&'static str>,
    pub has_transforms: bool,
}

impl<'a> UserCodeTransformer<'a> {
    pub fn new(allocator: &'a Allocator, ast_builder: &'a AstBuilder<'a>) -> Self {
        Self {
            allocator,
            ast_builder,
            methods: METHODS_TO_WRAP.iter().copied().collect(),
            has_transforms: false,
        }
    }

    fn is_target_method(&self, name: &str) -> bool {
        self.methods.contains(name)
    }

    /// Build: __zen_wrapMethodCallResult(subject, (__a) => __a.method(args))
    fn build_wrapped_call(
        &self,
        subject: Expression<'a>,
        method_name: &str,
        arguments: oxc_allocator::Vec<'a, Argument<'a>>,
        optional: bool,
    ) -> Expression<'a> {
        let builder = self.ast_builder;

        // Build the inner call: __a.method(args)
        let inner_callee =
            Expression::StaticMemberExpression(builder.alloc_static_member_expression(
                SPAN,
                builder.expression_identifier(SPAN, "__a"),
                builder.identifier_name(SPAN, self.allocator.alloc_str(method_name)),
                false,
            ));

        let inner_call = builder.expression_call(
            SPAN,
            inner_callee,
            oxc_ast::NONE,
            arguments,
            optional,
        );

        // Build arrow function body: { return __a.method(args); }
        // Use expression body for conciseness: (__a) => __a.method(args)
        let mut body_stmts = builder.vec_with_capacity(1);
        body_stmts.push(Statement::ExpressionStatement(
            builder.alloc_expression_statement(SPAN, inner_call),
        ));

        let body: oxc_allocator::Box<'a, FunctionBody<'a>> =
            builder.alloc_function_body(SPAN, builder.vec(), body_stmts);

        // Build params: (__a)
        let mut params_items = builder.vec_with_capacity(1);
        params_items.push(builder.formal_parameter(
            SPAN,
            builder.vec(),
            builder.binding_pattern_binding_identifier(SPAN, "__a"),
            oxc_ast::NONE, // type_annotation
            oxc_ast::NONE, // initializer
            false,         // optional
            None,          // accessibility
            false,         // readonly
            false,         // override
        ));

        let params: oxc_allocator::Box<'a, FormalParameters<'a>> =
            builder.alloc_formal_parameters(
                SPAN,
                FormalParameterKind::ArrowFormalParameters,
                params_items,
                oxc_ast::NONE,
            );

        // Build arrow function: (__a) => __a.method(args)
        let arrow = builder.expression_arrow_function(
            SPAN,
            true, // expression body (concise arrow)
            false,
            oxc_ast::NONE,
            params,
            oxc_ast::NONE,
            body,
        );

        // Build outer call: __zen_wrapMethodCallResult(subject, arrow)
        let mut outer_args = builder.vec_with_capacity(2);
        outer_args.push(Argument::from(subject));
        outer_args.push(Argument::from(arrow));

        builder.expression_call(
            SPAN,
            builder.expression_identifier(SPAN, WRAP_HOOK_NAME),
            oxc_ast::NONE,
            outer_args,
            false,
        )
    }
}

impl<'a> Traverse<'a, TraverseState> for UserCodeTransformer<'a> {
    fn exit_expression(
        &mut self,
        node: &mut Expression<'a>,
        _ctx: &mut TraverseCtx<'a, TraverseState>,
    ) {
        // Check if this is: expr.method(args) where method is in our target list
        let should_transform = match node {
            Expression::CallExpression(call_expr) => match &call_expr.callee {
                Expression::StaticMemberExpression(member_expr) => {
                    self.is_target_method(member_expr.property.name.as_str())
                }
                _ => false,
            },
            _ => false,
        };

        if !should_transform {
            return;
        }

        // Take the expression out, replacing with a placeholder
        let placeholder = self.ast_builder.expression_null_literal(SPAN);
        let old_expr = std::mem::replace(node, placeholder);

        // Destructure the call expression
        let Expression::CallExpression(call_box) = old_expr else {
            unreachable!()
        };

        let call_expr = call_box.unbox();
        let Expression::StaticMemberExpression(member_box) = call_expr.callee else {
            unreachable!()
        };

        let member_expr = member_box.unbox();
        let method_name = member_expr.property.name.as_str();
        let subject = member_expr.object;
        let arguments = call_expr.arguments;

        // Build the wrapped expression
        *node = self.build_wrapped_call(subject, method_name, arguments, call_expr.optional);
        self.has_transforms = true;
    }
}
