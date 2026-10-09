use oxc_allocator::{Allocator, Vec as OxcVec};
use oxc_ast::{
    ast::{
        Argument, BindingIdentifier, BindingPattern, BindingProperty, Expression,
        IdentifierReference, ImportDeclarationSpecifier, ImportOrExportKind, ModuleExportName,
        PropertyKey, Statement, StringLiteral, VariableDeclarationKind, VariableDeclarator,
    },
    builder::AstBuilder,
};
use oxc_span::{SPAN, SourceType};

use crate::js_transformer::instructions::{FileInstructions, FunctionInstructions};

const INSTRUMENT_IMPORT_SOURCE: &str = "@aikidosec/firewall/instrument/internals";
const INSTRUMENT_INSPECT_ARGS_METHOD_NAME: &str = "__instrumentInspectArgs";
const INSTRUMENT_MODIFY_ARGS_METHOD_NAME: &str = "__instrumentModifyArgs";
const INSTRUMENT_MODIFY_RETURN_VALUE_METHOD_NAME: &str = "__instrumentModifyReturnValue";
const INSTRUMENT_ACCESS_LOCAL_VARS_METHOD_NAME: &str = "__instrumentAccessLocalVariables";

type ImportMethodPredicate = fn(&FunctionInstructions) -> bool;

const IMPORT_METHODS: [(&str, ImportMethodPredicate); 3] = [
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

fn is_common_js(source_type: &SourceType, has_module_syntax: bool) -> bool {
    if source_type.is_commonjs() {
        return true;
    }
    if source_type.is_unambiguous() && !has_module_syntax {
        return true; // Unambiguous mode without module syntax
    }
    false // Otherwise, it's ESM
}

pub fn insert_import_statement<'a>(
    source_type: &SourceType,
    has_module_syntax: bool,
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    body: &mut OxcVec<'a, Statement<'a>>,
    file_instructions: &FileInstructions,
) {
    // Common JS require() statement
    if is_common_js(source_type, has_module_syntax) {
        let mut require_args: OxcVec<'a, Argument<'a>> = OxcVec::with_capacity_in(1, &allocator);
        require_args.push(Argument::StringLiteral(StringLiteral::boxed(
            SPAN,
            allocator.alloc_str(INSTRUMENT_IMPORT_SOURCE),
            None,
            builder,
        )));

        let mut binding_properties: OxcVec<'a, BindingProperty<'a>> =
            OxcVec::with_capacity_in(3, &allocator);

        for (method_name, predicate) in IMPORT_METHODS.iter() {
            // Only import the function if it is used in the file
            if file_instructions.functions.iter().any(predicate) {
                binding_properties.push(BindingProperty::new(
                    SPAN,
                    PropertyKey::new_static_identifier(SPAN, *method_name, builder),
                    BindingPattern::new_binding_identifier(SPAN, *method_name, builder),
                    true,
                    false,
                    builder,
                ));
            }
        }

        if !file_instructions.access_local_variables.is_empty() {
            binding_properties.push(BindingProperty::new(
                SPAN,
                PropertyKey::new_static_identifier(
                    SPAN,
                    INSTRUMENT_ACCESS_LOCAL_VARS_METHOD_NAME,
                    builder,
                ),
                BindingPattern::new_binding_identifier(
                    SPAN,
                    INSTRUMENT_ACCESS_LOCAL_VARS_METHOD_NAME,
                    builder,
                ),
                true,
                false,
                builder,
            ));
        }

        if binding_properties.is_empty() {
            // If there are no methods to import, we can skip the require statement
            return;
        }

        let mut declarations = OxcVec::with_capacity_in(1, &allocator);
        declarations.push(VariableDeclarator::new(
            SPAN,
            BindingPattern::new_object_pattern(SPAN, binding_properties, None, builder),
            None,
            Some(Expression::new_call_expression(
                SPAN,
                Expression::Identifier(IdentifierReference::boxed(SPAN, "require", builder)),
                None,
                require_args,
                false,
                builder,
            )),
            false,
            builder,
        ));

        let var_declaration = Statement::new_variable_declaration(
            SPAN,
            VariableDeclarationKind::Const,
            declarations,
            false,
            builder,
        );

        body.insert(0, var_declaration);

        return;
    }
    // else: ESM import statement

    let mut specifiers: OxcVec<'a, ImportDeclarationSpecifier<'a>> =
        OxcVec::with_capacity_in(3, &allocator);
    for (method_name, predicate) in IMPORT_METHODS.iter() {
        if file_instructions.functions.iter().any(predicate) {
            specifiers.push(ImportDeclarationSpecifier::new_import_specifier(
                SPAN,
                ModuleExportName::new_identifier_name(SPAN, *method_name, builder),
                BindingIdentifier::new(SPAN, *method_name, builder),
                ImportOrExportKind::Value,
                builder,
            ));
        }
    }

    if !file_instructions.access_local_variables.is_empty() {
        specifiers.push(ImportDeclarationSpecifier::new_import_specifier(
            SPAN,
            ModuleExportName::new_identifier_name(
                SPAN,
                INSTRUMENT_ACCESS_LOCAL_VARS_METHOD_NAME,
                builder,
            ),
            BindingIdentifier::new(SPAN, INSTRUMENT_ACCESS_LOCAL_VARS_METHOD_NAME, builder),
            ImportOrExportKind::Value,
            builder,
        ));
    }

    if specifiers.is_empty() {
        // If there are no methods to import, we can skip the import statement
        return;
    }

    let import_stmt = Statement::new_import_declaration(
        SPAN,
        Some(specifiers),
        StringLiteral::new(
            SPAN,
            allocator.alloc_str(INSTRUMENT_IMPORT_SOURCE),
            None,
            builder,
        ),
        None,
        None,
        ImportOrExportKind::Value,
        builder,
    );

    body.insert(0, import_stmt);
}
