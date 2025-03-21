use oxc_allocator::{Allocator, Box};
use oxc_ast::ast::{FunctionBody, MethodDefinition};
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;
use oxc_traverse::{traverse_mut, Traverse, TraverseCtx};

use super::{
    helpers::{
        get_import_code_str::get_import_code_str, get_method_arg_names::get_method_arg_names,
        parse_js_code_to_statements::parse_js_code_to_statements,
        select_sourcetype_based_on_enum::select_sourcetype_based_on_enum,
    },
    instructions::FileInstructions,
};

pub fn transform_code_str(code: &str, instructions_json: &str, src_type: i32) -> String {
    let allocator = Allocator::default();

    let file_instructions: FileInstructions =
        serde_json::from_str(instructions_json).expect("Invalid JSON");

    let source_type = select_sourcetype_based_on_enum(src_type);

    let parser_result = Parser::new(&allocator, &code, source_type)
        .with_options(ParseOptions {
            allow_return_outside_function: true, // Maybe some run
            ..ParseOptions::default()
        })
        .parse();

    if parser_result.panicked || parser_result.errors.len() > 0 {
        return format!("#ERR: {:?}", parser_result.errors);
    }

    let program = allocator.alloc(parser_result.program);

    // 2 Semantic Analyze
    let semantic = SemanticBuilder::new().build(&program);

    if !semantic.errors.is_empty() {
        return format!("#ERR: {:?}", semantic.errors);
    }

    let (symbols, scopes) = semantic.semantic.into_symbol_table_and_scope_tree();

    let t = &mut Transformer {
        allocator: &allocator,
        file_instructions: &file_instructions,
    };

    traverse_mut(t, &allocator, program, symbols, scopes);

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

struct Transformer<'a> {
    allocator: &'a Allocator,
    file_instructions: &'a FileInstructions,
}

impl<'a> Traverse<'a> for Transformer<'a> {
    fn enter_method_definition(
        &mut self,
        node: &mut MethodDefinition<'a>,
        _ctx: &mut TraverseCtx<'a>,
    ) {
        if !node.key.is_identifier() || !node.value.body.is_some() || !node.key.name().is_some() {
            return;
        }

        if !node.kind.is_method() {
            // Ignore constructor, getters and setters for now
            return;
        }

        let method_name = node.key.name().unwrap().to_string();

        let found_instruction = self
            .file_instructions
            .functions
            .iter()
            .find(|f| f.node_type == "MethodDefinition" && f.name == method_name);

        if found_instruction.is_none() {
            return;
        }

        let instruction = found_instruction.unwrap();

        // We need to collect the arg names before we make the body mutable
        let arg_names = if instruction.modify_args {
            get_method_arg_names(node)
        } else {
            Vec::new()
        };

        let body = node.value.body.as_mut().unwrap();

        if instruction.modify_args && !arg_names.is_empty() {
            // Modify the arguments by adding a statement to the beginning of the function
            // [arg1, arg2, ...] = __instrumentModifyArgs('function_identifier', [arg1, arg2, ...]);

            let arg_names_str = arg_names.join(", ");
            let source_text: &'a str = self.allocator.alloc_str(&format!(
                "[{}] = __instrumentModifyArgs('{}', [{}]);",
                arg_names_str, instruction.identifier, arg_names_str
            ));

            insert_single_statement_into_func(self.allocator, body, 0, &source_text);
        }

        if instruction.inspect_args {
            // Add a statement to the beginning of the function: __instrumentInspectArgs('function_identifier', arguments);
            let source_text: &'a str = self.allocator.alloc_str(&format!(
                "__instrumentInspectArgs('{}', arguments);",
                instruction.identifier
            ));

            insert_single_statement_into_func(self.allocator, body, 0, source_text);
        }

        // Todo support return value modification
    }
}

fn insert_single_statement_into_func<'a>(
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
