use std::collections::HashSet;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Argument, AssignmentOperator, AssignmentTarget, BinaryOperator, Expression,
    FormalParameterKind, FormalParameters, FunctionBody, ImportOrExportKind, Statement,
    VariableDeclarationKind,
};
use oxc_ast::{AstBuilder, NONE};
use oxc_codegen::{Codegen, CodegenOptions, CommentOptions};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::{SPAN, SourceType};
use oxc_traverse::{Traverse, TraverseCtx, traverse_mut};

use super::helpers::select_sourcetype_based_on_enum::select_sourcetype_based_on_enum;
use super::transformer_impl::TraverseState;

const WRAP_HOOK_NAME: &str = "__zen_wrapMethodCallResult";
const CONCAT_HOOK_NAME: &str = "__zen_wrapConcat";
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
    if code.contains(WRAP_HOOK_NAME) || code.contains(CONCAT_HOOK_NAME) {
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

    if !t.has_method_transforms && !t.has_concat_transforms {
        // No transforms found - return original code unchanged
        return Ok(code.to_string());
    }

    // Collect which hooks need to be imported
    let mut hooks: Vec<&str> = Vec::new();
    if t.has_method_transforms {
        hooks.push(WRAP_HOOK_NAME);
    }
    if t.has_concat_transforms {
        hooks.push(CONCAT_HOOK_NAME);
    }

    // Insert import for the hooks that are used
    insert_wrap_hook_import(
        &source_type,
        parser_result.module_record.has_module_syntax,
        &allocator,
        &ast_builder,
        &mut program.body,
        &hooks,
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
    hooks: &[&'a str],
) {
    if is_common_js(source_type, has_module_syntax) {
        // const { hook1, hook2 } = require("@aikidosec/firewall/instrument/internals");
        let mut require_args = builder.vec_with_capacity(1);
        require_args.push(Argument::StringLiteral(builder.alloc_string_literal(
            SPAN,
            allocator.alloc_str(INSTRUMENT_IMPORT_SOURCE),
            None,
        )));

        let mut binding_properties = builder.vec_with_capacity(hooks.len());
        for &hook in hooks {
            binding_properties.push(builder.binding_property(
                SPAN,
                builder.property_key_static_identifier(SPAN, hook),
                builder.binding_pattern_binding_identifier(SPAN, hook),
                true,
                false,
            ));
        }

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

    // ESM: import { hook1, hook2 } from "@aikidosec/firewall/instrument/internals";
    let mut specifiers = builder.vec_with_capacity(hooks.len());
    for &hook in hooks {
        specifiers.push(builder.import_declaration_specifier_import_specifier(
            SPAN,
            builder.module_export_name_identifier_name(SPAN, hook),
            builder.binding_identifier(SPAN, hook),
            ImportOrExportKind::Value,
        ));
    }

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
    pub has_method_transforms: bool,
    pub has_concat_transforms: bool,
}

impl<'a> UserCodeTransformer<'a> {
    pub fn new(allocator: &'a Allocator, ast_builder: &'a AstBuilder<'a>) -> Self {
        Self {
            allocator,
            ast_builder,
            methods: METHODS_TO_WRAP.iter().copied().collect(),
            has_method_transforms: false,
            has_concat_transforms: false,
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

        let inner_call =
            builder.expression_call(SPAN, inner_callee, oxc_ast::NONE, arguments, optional);

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

        let params: oxc_allocator::Box<'a, FormalParameters<'a>> = builder.alloc_formal_parameters(
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

    /// Build: __zen_wrapConcat(arg1, arg2, ...)
    fn build_concat_call(&self, arguments: oxc_allocator::Vec<'a, Argument<'a>>) -> Expression<'a> {
        self.ast_builder.expression_call(
            SPAN,
            self.ast_builder
                .expression_identifier(SPAN, CONCAT_HOOK_NAME),
            oxc_ast::NONE,
            arguments,
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
        enum TransformKind {
            MethodCall,
            ConcatMethodCall,
            BinaryAddition,
            AssignmentAddition,
        }

        // Determine what kind of transform to apply (read-only check)
        let transform = match node {
            Expression::CallExpression(call_expr) => match &call_expr.callee {
                Expression::StaticMemberExpression(member_expr) => {
                    let name = member_expr.property.name.as_str();
                    if name == "concat" {
                        Some(TransformKind::ConcatMethodCall)
                    } else if self.is_target_method(name) {
                        Some(TransformKind::MethodCall)
                    } else {
                        None
                    }
                }
                _ => None,
            },
            Expression::BinaryExpression(bin_expr)
                if bin_expr.operator == BinaryOperator::Addition =>
            {
                Some(TransformKind::BinaryAddition)
            }
            Expression::AssignmentExpression(assign_expr)
                if assign_expr.operator == AssignmentOperator::Addition
                    && matches!(
                        &assign_expr.left,
                        AssignmentTarget::AssignmentTargetIdentifier(_)
                    ) =>
            {
                Some(TransformKind::AssignmentAddition)
            }
            _ => None,
        };

        let Some(transform) = transform else {
            return;
        };

        let placeholder = self.ast_builder.expression_null_literal(SPAN);
        let old_expr = std::mem::replace(node, placeholder);

        match transform {
            TransformKind::MethodCall => {
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

                *node =
                    self.build_wrapped_call(subject, method_name, arguments, call_expr.optional);
                self.has_method_transforms = true;
            }

            TransformKind::ConcatMethodCall => {
                // str.concat(a, b) → __zen_wrapConcat(str, a, b)
                let Expression::CallExpression(call_box) = old_expr else {
                    unreachable!()
                };
                let call_expr = call_box.unbox();
                let Expression::StaticMemberExpression(member_box) = call_expr.callee else {
                    unreachable!()
                };
                let member_expr = member_box.unbox();
                let subject = member_expr.object;
                let arguments = call_expr.arguments;

                let mut new_args = self.ast_builder.vec_with_capacity(arguments.len() + 1);
                new_args.push(Argument::from(subject));
                for arg in arguments.into_iter() {
                    new_args.push(arg);
                }

                *node = self.build_concat_call(new_args);
                self.has_concat_transforms = true;
            }

            TransformKind::BinaryAddition => {
                // a + b → __zen_wrapConcat(a, b)
                let Expression::BinaryExpression(bin_box) = old_expr else {
                    unreachable!()
                };
                let bin_expr = bin_box.unbox();

                let mut args = self.ast_builder.vec_with_capacity(2);
                args.push(Argument::from(bin_expr.left));
                args.push(Argument::from(bin_expr.right));

                *node = self.build_concat_call(args);
                self.has_concat_transforms = true;
            }

            TransformKind::AssignmentAddition => {
                // a += b → a = __zen_wrapConcat(a, b)
                let Expression::AssignmentExpression(assign_box) = old_expr else {
                    unreachable!()
                };
                let assign_expr = assign_box.unbox();

                // Extract identifier name from target to create an expression
                let AssignmentTarget::AssignmentTargetIdentifier(ref ident) = assign_expr.left
                else {
                    unreachable!()
                };
                let left_expr = self
                    .ast_builder
                    .expression_identifier(SPAN, self.allocator.alloc_str(ident.name.as_str()));

                let mut args = self.ast_builder.vec_with_capacity(2);
                args.push(Argument::from(left_expr));
                args.push(Argument::from(assign_expr.right));

                let concat_call = self.build_concat_call(args);

                *node = self.ast_builder.expression_assignment(
                    SPAN,
                    AssignmentOperator::Assign,
                    assign_expr.left,
                    concat_call,
                );
                self.has_concat_transforms = true;
            }
        }
    }
}
