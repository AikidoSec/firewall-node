use oxc_allocator::Allocator;
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;
use oxc_traverse::traverse_mut;

use super::{
    helpers::{
        get_import_code_str::get_import_code_str,
        parse_js_code_to_statements::parse_js_code_to_statements,
        select_sourcetype_based_on_enum::select_sourcetype_based_on_enum,
    },
    instructions::FileInstructions,
    transformer_impl::Transformer,
};

pub fn transform_code_str(
    pkg_name: &str,
    pkg_version: &str,
    code: &str,
    instructions_json: &str,
    src_type: i32,
) -> String {
    let allocator = Allocator::default();

    let file_instructions: FileInstructions =
        serde_json::from_str(instructions_json).expect("Invalid JSON");

    let source_type = select_sourcetype_based_on_enum(src_type);

    let parser_result = Parser::new(&allocator, &code, source_type).parse();

    if parser_result.panicked || parser_result.errors.len() > 0 {
        return format!("#ERR: {:?}", parser_result.errors);
    }

    let program = allocator.alloc(parser_result.program);

    // 2 Semantic Analyze
    let semantic = SemanticBuilder::new().build(&program);

    if !semantic.errors.is_empty() {
        return format!("#ERR: {:?}", semantic.errors);
    }

    let (scopes, _nodes) = semantic.semantic.into_scoping_and_nodes();

    let t = &mut Transformer {
        allocator: &allocator,
        file_instructions: &file_instructions,
        pkg_name: &pkg_name,
        pkg_version: &pkg_version,
    };

    traverse_mut(t, &allocator, program, scopes);

    // Add import / require statement
    program.body.insert(
        0,
        parse_js_code_to_statements(
            &allocator,
            get_import_code_str(&source_type, parser_result.module_record.has_module_syntax),
            SourceType::cjs(),
        )
        .pop()
        .unwrap(),
    );

    // Todo: Update source map?
    let js = Codegen::new()
        .with_options(CodegenOptions {
            comments: true,
            minify: false,
            // Todo add source map using source_map_path
            ..CodegenOptions::default()
        })
        .build(&program);

    js.code
}
