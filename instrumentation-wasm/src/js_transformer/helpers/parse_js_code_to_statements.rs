use oxc_allocator::{Allocator, Vec};
use oxc_ast::ast::Statement;
use oxc_parser::{ParseOptions, Parser};
use oxc_span::SourceType;

// Todo replace with AstBuilder in the future, most likely better performance
pub fn parse_js_code_to_statements<'a>(
    allocator: &'a Allocator,
    source_text: &'a str,
    source_type: SourceType,
) -> Vec<'a, Statement<'a>> {
    let parser_result = Parser::new(&allocator, source_text, source_type)
        .with_options(ParseOptions {
            allow_return_outside_function: true, // Could be partical code string that should be parsed
            ..ParseOptions::default()
        })
        .parse();

    return parser_result.program.body;
}
