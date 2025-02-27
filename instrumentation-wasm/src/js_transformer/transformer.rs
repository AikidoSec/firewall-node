use oxc_allocator::Allocator;
use oxc_ast::ast::MethodDefinition;
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;
use oxc_traverse::{traverse_mut, Traverse, TraverseCtx};

use super::{
    helpers::{
        parse_js_code_to_statements::parse_js_code_to_statements,
        select_sourcetype_based_on_enum::select_sourcetype_based_on_enum,
    },
    instructions::FileInstructions,
};

pub fn transform_code_str(
    code: &str,
    module_name: &str,
    instructions_json: &str,
    src_type: i32,
) -> String {
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
        current_function_identifier: None,
        modify_return_value: false,
        module_name,
        sub_function_counter: 0,
    };

    traverse_mut(t, &allocator, program, symbols, scopes);

    // Add import statement
    program.body.insert(
        0,
        parse_js_code_to_statements(
            &allocator,
            "import { __instrumentInspectArgs } from '@aikidosec/firewall/instrument/internals';",
            SourceType::mjs(),
        )
        .pop()
        .unwrap(),
    );

    // Todo: Update source map?
    let js = Codegen::new()
        .with_options(CodegenOptions {
            comments: true,
            minify: false,
            ..CodegenOptions::default()
        })
        .build(&program);

    // Debug helper
    //format!("{:?}", parser_result.program);

    js.code
}

struct Transformer<'a> {
    allocator: &'a Allocator,
    file_instructions: &'a FileInstructions,
    current_function_identifier: Option<String>, // Only set if we want to instrument the current function
    sub_function_counter: i32, // Counter to keep track of how many sub functions we are in
    modify_return_value: bool,
    module_name: &'a str,
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

        // Todo implement submethod counting for nested functions for supporting modifications of return value

        let method_name = node.key.name().unwrap().to_string();

        let found_instruction = self
            .file_instructions
            .functions
            .iter()
            .find(|f| f.node_type == "MethodDefinition" && f.name == method_name);

        if found_instruction.is_none() {
            self.current_function_identifier = None;
            self.modify_return_value = false;
            return;
        }

        let instruction = found_instruction.unwrap();

        let function_identifier = format!("{}.{}", self.module_name, method_name);
        self.current_function_identifier = Some(function_identifier.clone());
        self.modify_return_value = instruction.modify_return_value;

        let body = node.value.body.as_mut().unwrap();

        if instruction.inspect_args {
            let source_text: &'a str = self.allocator.alloc_str(&format!(
                "__instrumentInspectArgs('{}', arguments);",
                self.current_function_identifier.as_ref().unwrap()
            ));

            body.statements.insert(
                0,
                parse_js_code_to_statements(self.allocator, &source_text, SourceType::mjs())
                    .into_iter()
                    .next()
                    .unwrap(),
            );
        }
    }

    fn exit_method_definition(
        &mut self,
        _node: &mut MethodDefinition<'a>,
        ctx: &mut TraverseCtx<'a>,
    ) {
        if self.current_function_identifier.is_none() {
            return;
        }

        // If we are in a sub function, we need to decrease the counter
        // If we leave the last sub function, we need to modify the return value again
        if self.sub_function_counter > 0 {
            self.sub_function_counter -= 1;

            if self.sub_function_counter == 0 {
                self.modify_return_value = true;
            }

            return;
        }

        // We leave the current function we want to instrument
        self.modify_return_value = false;
        self.current_function_identifier = None;
    }

    fn enter_return_statement(
        &mut self,
        node: &mut oxc_ast::ast::ReturnStatement<'a>,
        ctx: &mut TraverseCtx<'a>,
    ) {
        if !self.modify_return_value {
            return;
        }

        // Todo support modifying return value
        //AstBuilder::new(self.allocator).return_statement(node.span, argument)
    }
}
