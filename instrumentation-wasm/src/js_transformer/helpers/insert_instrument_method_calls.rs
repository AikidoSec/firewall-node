use oxc_allocator::{Allocator, Box};
use oxc_ast::{AstBuilder, ast::FunctionBody};

use crate::js_transformer::{
    helpers::{
        insert_code::{insert_inspect_args, insert_modify_args},
        transform_return_statements::transform_return_statements,
    },
    instructions::FunctionInstructions,
};

pub fn insert_instrument_method_calls<'a>(
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    instruction: &FunctionInstructions,
    arg_names: &Vec<String>,
    pkg_version: &'a str,
    body: &mut Box<'a, FunctionBody<'a>>,
    is_constructor: bool,
) {
    if instruction.modify_args && !arg_names.is_empty() {
        insert_modify_args(
            allocator,
            builder,
            &instruction.identifier,
            arg_names,
            body,
            instruction.modify_arguments_object,
            is_constructor,
        );
    }

    if instruction.inspect_args {
        insert_inspect_args(
            allocator,
            builder,
            &instruction.identifier,
            pkg_version,
            body,
            is_constructor,
        );
    }

    if instruction.modify_return_value && !is_constructor {
        transform_return_statements(
            allocator,
            builder,
            &instruction.identifier,
            &mut body.statements,
        );
    }
}
