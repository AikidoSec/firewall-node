use oxc_allocator::Allocator;
use oxc_ast::AstBuilder;
use oxc_codegen::{Codegen, CodegenOptions, CommentOptions};
use oxc_parser::Parser;

use super::helpers::{
    insert_code::insert_package_loaded, insert_import_statement::insert_import_statement_for_sca,
    select_sourcetype_based_on_enum::select_sourcetype_based_on_enum,
};

pub fn transform_code_str_insert_sca(
    pkg_name: &str,
    pkg_version: &str,
    code: &str,
    src_type: &str,
) -> Result<String, String> {
    let allocator = Allocator::default();

    let source_type = select_sourcetype_based_on_enum(src_type);

    let mut parser_result = Parser::new(&allocator, code, source_type).parse();

    if parser_result.panicked || !parser_result.errors.is_empty() {
        return Err(format!(
            "Error while parsing code: {:?}",
            parser_result.errors
        ));
    }

    let program = &mut parser_result.program;

    let ast_builder = AstBuilder::new(&allocator);

    // Add import / require statement
    insert_import_statement_for_sca(
        &source_type,
        parser_result.module_record.has_module_syntax,
        &allocator,
        &ast_builder,
        &mut program.body,
    );

    insert_package_loaded(
        &allocator,
        &ast_builder,
        pkg_name,
        pkg_version,
        &mut program.body,
    );

    // Todo: Update source map?
    let js = Codegen::new()
        .with_options(CodegenOptions {
            comments: CommentOptions {
                normal: true,
                jsdoc: true,
                annotation: true,
                legal: oxc_codegen::LegalComment::Inline,
            },
            minify: false,
            // Todo add source map using source_map_path
            ..CodegenOptions::default()
        })
        .build(program);

    Ok(js.code)
}
