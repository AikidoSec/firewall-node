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
