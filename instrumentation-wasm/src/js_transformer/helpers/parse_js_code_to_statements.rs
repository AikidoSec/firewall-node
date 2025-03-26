use oxc_allocator::{Allocator, Vec};
use oxc_ast::ast::Statement;
use oxc_parser::{ParseOptions, Parser};
use oxc_span::SourceType;

pub fn parse_js_code_to_statements<'a>(
    allocator: &'a Allocator,
    source_text: &'a str,
    source_type: SourceType,
) -> Vec<'a, Statement<'a>> {
    let parser_result = Parser::new(&allocator, source_text, source_type)
        .with_options(ParseOptions {
            allow_return_outside_function: true,
            ..ParseOptions::default()
        })
        .parse();

    return parser_result.program.body;
}
