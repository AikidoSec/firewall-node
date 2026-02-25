use oxc_allocator::Allocator;
use oxc_ast::AstBuilder;
use oxc_codegen::{Codegen, CodegenOptions, CommentOptions};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_traverse::traverse_mut;

use crate::js_transformer::helpers::insert_code::insert_package_wrapped;

use super::{
    helpers::{
        code_str_includes_instrument_funcs::code_str_includes_instrument_funcs,
        insert_code::insert_access_local_var,
        insert_import_statement::insert_import_statement_for_instructions,
        select_sourcetype_based_on_enum::select_sourcetype_based_on_enum,
    },
    instructions::FileInstructions,
    transformer_impl::{Transformer, TraverseState},
};

pub fn transform_code_str(
    pkg_name: &str,
    pkg_version: &str,
    code: &str,
    instructions_json: &str,
    src_type: &str,
    is_bundling: bool,
) -> Result<String, String> {
    let allocator = Allocator::default();

    if code_str_includes_instrument_funcs(code) {
        return Err("Code already contains instrument functions".to_string());
    }

    let file_instructions: FileInstructions =
        serde_json::from_str(instructions_json).expect("Invalid JSON");

    let source_type = select_sourcetype_based_on_enum(src_type);

    let mut parser_result = Parser::new(&allocator, code, source_type).parse();

    if parser_result.panicked || !parser_result.errors.is_empty() {
        return Err(format!(
            "Error while parsing code: {:?}",
            parser_result.errors
        ));
    }

    let program = &mut parser_result.program;

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
    insert_import_statement_for_instructions(
        &source_type,
        parser_result.module_record.has_module_syntax,
        &allocator,
        &ast_builder,
        &mut program.body,
        &file_instructions,
        is_bundling,
    );

    if !file_instructions.access_local_variables.is_empty() {
        insert_access_local_var(
            &allocator,
            &ast_builder,
            &file_instructions.identifier,
            &file_instructions.access_local_variables,
            &mut program.body,
        );
    }

    if is_bundling {
        insert_package_wrapped(
            &allocator,
            &ast_builder,
            pkg_name,
            pkg_version,
            &mut program.body,
        );
    }

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
