use super::parse_js_code_to_statements::parse_js_code_to_statements;
use oxc_allocator::{Allocator, Box};
use oxc_ast::ast::FunctionBody;
use oxc_span::SourceType;

pub fn insert_single_statement_into_func<'a>(
    allocator: &'a Allocator,
    body: &mut Box<'a, FunctionBody<'a>>,
    pos: usize,
    source_text: &'a str,
) {
    body.statements.insert(
        pos,
        parse_js_code_to_statements(&allocator, &source_text, SourceType::mjs())
            .into_iter()
            .next()
            .unwrap(),
    );
}

// Add a statement to the beginning of the function: __instrumentInspectArgs('function_identifier', arguments);
pub fn insert_inspect_args<'a>(
    allocator: &'a Allocator,
    identifier: &str,
    pkg_name: &'a str,
    pkg_version: &'a str,
    instruction_name: &str,
    body: &mut Box<'a, FunctionBody<'a>>,
) {
    let source_text: &'a str = allocator.alloc_str(&format!(
        "__instrumentInspectArgs('{}', arguments, '{}', '{}', '{}', this);",
        identifier, pkg_name, pkg_version, instruction_name
    ));

    insert_single_statement_into_func(allocator, body, 0, source_text);
}

// Modify the arguments by adding a statement to the beginning of the function
// [arg1, arg2, ...] = __instrumentModifyArgs('function_identifier', [arg1, arg2, ...]);
pub fn insert_modify_args<'a>(
    allocator: &'a Allocator,
    identifier: &str,
    arg_names_str: &str,
    body: &mut Box<'a, FunctionBody<'a>>,
) {
    let source_text: &'a str = allocator.alloc_str(&format!(
        "[{}] = __instrumentModifyArgs('{}', [{}]);",
        arg_names_str, identifier, arg_names_str
    ));

    insert_single_statement_into_func(allocator, body, 0, source_text);
}
