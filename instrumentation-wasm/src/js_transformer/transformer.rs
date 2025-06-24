use oxc_allocator::Allocator;
use oxc_ast::AstBuilder;
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_traverse::traverse_mut;

use super::{
    helpers::{
        insert_import_statement::insert_import_statement,
        select_sourcetype_based_on_enum::select_sourcetype_based_on_enum,
    },
    instructions::FileInstructions,
    transformer_impl::{Transformer, TraverseState},
};

pub fn transform_code_str(
    _pkg_name: &str,
    pkg_version: &str,
    code: &str,
    instructions_json: &str,
    src_type: &str,
) -> Result<String, String> {
    let allocator = Allocator::default();

    let file_instructions: FileInstructions =
        serde_json::from_str(instructions_json).expect("Invalid JSON");

    let source_type = select_sourcetype_based_on_enum(src_type);

    let parser_result = Parser::new(&allocator, code, source_type).parse();

    if parser_result.panicked || !parser_result.errors.is_empty() {
        return Err(format!(
            "Error while parsing code: {:?}",
            parser_result.errors
        ));
    }

    let program = allocator.alloc(parser_result.program);

    // 2 Semantic Analyze
    let semantic = SemanticBuilder::new().build(program);

    if !semantic.errors.is_empty() {
        return Err(format!(
            "Error during semantic analysis: {:?}",
            semantic.errors
        ));
    }

    let (scopes, _nodes) = semantic.semantic.into_scoping_and_nodes();

    let ast_builder = AstBuilder::new(&allocator);

    let t = &mut Transformer {
        allocator: &allocator,
        file_instructions: &file_instructions,
        pkg_version,
        ast_builder: &ast_builder,
    };

    let state = TraverseState {};

    traverse_mut(t, &allocator, program, scopes, state);

    // Add import / require statement
    insert_import_statement(
        &source_type,
        parser_result.module_record.has_module_syntax,
        &allocator,
        &ast_builder,
        &mut program.body,
        &file_instructions,
    );

    // Todo: Update source map?
    let js = Codegen::new()
        .with_options(CodegenOptions {
            comments: true,
            minify: false,
            // Todo add source map using source_map_path
            ..CodegenOptions::default()
        })
        .build(program);

    Ok(js.code)
}
