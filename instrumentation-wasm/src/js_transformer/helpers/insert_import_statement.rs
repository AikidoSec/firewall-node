use oxc_allocator::{Allocator, Vec as OxcVec};
use oxc_ast::{
    ast::{
        Argument, BindingPatternKind, BindingProperty, ImportDeclarationSpecifier,
        ImportOrExportKind, Statement, VariableDeclarationKind,
    },
    AstBuilder, NONE,
};
use oxc_span::{SourceType, SPAN};

use crate::js_transformer::instructions::{FileInstructions, FunctionInstructions};

const INSTRUMENT_IMPORT_SOURCE: &str = "@aikidosec/firewall/instrument/internals";
const INSTRUMENT_INSPECT_ARGS_METHOD_NAME: &str = "__instrumentInspectArgs";
const INSTRUMENT_MODIFY_ARGS_METHOD_NAME: &str = "__instrumentModifyArgs";
const INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME: &str = "__instrumentModifyReturnValue";

const IMPORT_METHODS: [(&str, fn(&FunctionInstructions) -> bool); 3] = [
    (
        INSTRUMENT_INSPECT_ARGS_METHOD_NAME,
        |f: &FunctionInstructions| f.inspect_args,
    ),
    (
        INSTRUMENT_MODIFY_ARGS_METHOD_NAME,
        |f: &FunctionInstructions| f.modify_args,
    ),
    (
        INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME,
        |f: &FunctionInstructions| f.modify_return_value,
    ),
];

pub fn insert_import_statement<'a>(
    source_type: &SourceType,
    has_module_syntax: bool,
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    body: &mut OxcVec<'a, Statement<'a>>,
    file_instructions: &FileInstructions,
) {
    // Common JS require() statement
    if source_type.is_script() || source_type.is_unambiguous() && !has_module_syntax {
        let mut require_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(1);
        require_args.push(Argument::StringLiteral(builder.alloc_string_literal(
            SPAN,
            allocator.alloc_str(INSTRUMENT_IMPORT_SOURCE),
            None,
        )));

        let mut binding_properties: OxcVec<'a, BindingProperty<'a>> = builder.vec_with_capacity(3);

        for (method_name, predicate) in IMPORT_METHODS.iter() {
            // Only import the function if it is used in the file
            if file_instructions.functions.iter().any(|f| predicate(f)) {
                binding_properties.push(builder.binding_property(
                    SPAN,
                    builder.property_key_static_identifier(SPAN, *method_name),
                    builder.binding_pattern(
                        builder.binding_pattern_kind_binding_identifier(SPAN, *method_name),
                        NONE,
                        false,
                    ),
                    true,
                    false,
                ));
            }
        }

        if binding_properties.is_empty() {
            // If there are no methods to import, we can skip the require statement
            return;
        }

        let mut declarations = builder.vec_with_capacity(1);
        declarations.push(builder.variable_declarator(
            SPAN,
            VariableDeclarationKind::Const,
            builder.binding_pattern(
                BindingPatternKind::ObjectPattern(builder.alloc_object_pattern(
                    SPAN,
                    binding_properties,
                    NONE,
                )),
                NONE,
                false,
            ),
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
    // else: ESM import statement

    let mut specifiers: OxcVec<'a, ImportDeclarationSpecifier<'a>> = builder.vec_with_capacity(3);
    for (method_name, predicate) in IMPORT_METHODS.iter() {
        if file_instructions.functions.iter().any(|f| predicate(f)) {
            specifiers.push(builder.import_declaration_specifier_import_specifier(
                SPAN,
                builder.module_export_name_identifier_name(SPAN, *method_name),
                builder.binding_identifier(SPAN, *method_name),
                ImportOrExportKind::Value,
            ));
        }
    }

    if specifiers.is_empty() {
        // If there are no methods to import, we can skip the import statement
        return;
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
