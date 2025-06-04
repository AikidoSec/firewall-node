use oxc_allocator::{Allocator, Vec};
use oxc_ast::{
    ast::{
        Argument, BindingPatternKind, BindingProperty, ImportDeclarationSpecifier,
        ImportOrExportKind, Statement, VariableDeclarationKind,
    },
    AstBuilder, NONE,
};
use oxc_span::{SourceType, SPAN};

use crate::js_transformer::instructions::FileInstructions;

const INSTRUMENT_IMPORT_SOURCE: &str = "@aikidosec/firewall/instrument/internals";
const INSTRUMENT_INSPECT_ARGS_METHOD_NAME: &str = "__instrumentInspectArgs";
const INSTRUMENT_MODIFY_ARGS_METHOD_NAME: &str = "__instrumentModifyArgs";
const INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME: &str = "__instrumentModifyReturnValue";

pub fn insert_import_statement<'a>(
    source_type: &SourceType,
    has_module_syntax: bool,
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    body: &mut Vec<'a, Statement<'a>>,
    file_instructions: &FileInstructions,
) {
    // Common JS require() statement

    if source_type.is_script() || source_type.is_unambiguous() && !has_module_syntax {
        let mut require_args: Vec<'a, Argument<'a>> = builder.vec_with_capacity(1);
        require_args.push(Argument::StringLiteral(builder.alloc_string_literal(
            SPAN,
            allocator.alloc_str(INSTRUMENT_IMPORT_SOURCE),
            None,
        )));

        let mut binding_properties: Vec<'a, BindingProperty<'a>> = builder.vec_with_capacity(3);

        if file_instructions.functions.iter().any(|f| f.inspect_args) {
            binding_properties.push(builder.binding_property(
                SPAN,
                builder.property_key_static_identifier(SPAN, INSTRUMENT_INSPECT_ARGS_METHOD_NAME),
                builder.binding_pattern(
                    builder.binding_pattern_kind_binding_identifier(
                        SPAN,
                        INSTRUMENT_INSPECT_ARGS_METHOD_NAME,
                    ),
                    NONE,
                    false,
                ),
                true,
                false,
            ));
        }

        if file_instructions.functions.iter().any(|f| f.modify_args) {
            binding_properties.push(builder.binding_property(
                SPAN,
                builder.property_key_static_identifier(SPAN, INSTRUMENT_MODIFY_ARGS_METHOD_NAME),
                builder.binding_pattern(
                    builder.binding_pattern_kind_binding_identifier(
                        SPAN,
                        INSTRUMENT_MODIFY_ARGS_METHOD_NAME,
                    ),
                    NONE,
                    false,
                ),
                true,
                false,
            ));
        }

        if file_instructions
            .functions
            .iter()
            .any(|f| f.modify_return_value)
        {
            binding_properties.push(builder.binding_property(
                SPAN,
                builder.property_key_static_identifier(
                    SPAN,
                    INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME,
                ),
                builder.binding_pattern(
                    builder.binding_pattern_kind_binding_identifier(
                        SPAN,
                        INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME,
                    ),
                    NONE,
                    false,
                ),
                true,
                false,
            ));
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

    let mut specifiers: Vec<'a, ImportDeclarationSpecifier<'a>> = builder.vec_with_capacity(3);

    if file_instructions.functions.iter().any(|f| f.inspect_args) {
        specifiers.push(builder.import_declaration_specifier_import_specifier(
            SPAN,
            builder.module_export_name_identifier_name(SPAN, INSTRUMENT_INSPECT_ARGS_METHOD_NAME),
            builder.binding_identifier(SPAN, INSTRUMENT_INSPECT_ARGS_METHOD_NAME),
            ImportOrExportKind::Value,
        ));
    }

    if file_instructions.functions.iter().any(|f| f.modify_args) {
        specifiers.push(builder.import_declaration_specifier_import_specifier(
            SPAN,
            builder.module_export_name_identifier_name(SPAN, INSTRUMENT_MODIFY_ARGS_METHOD_NAME),
            builder.binding_identifier(SPAN, INSTRUMENT_MODIFY_ARGS_METHOD_NAME),
            ImportOrExportKind::Value,
        ));
    }

    if file_instructions
        .functions
        .iter()
        .any(|f| f.modify_return_value)
    {
        specifiers.push(builder.import_declaration_specifier_import_specifier(
            SPAN,
            builder.module_export_name_identifier_name(
                SPAN,
                INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME,
            ),
            builder.binding_identifier(SPAN, INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME),
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
