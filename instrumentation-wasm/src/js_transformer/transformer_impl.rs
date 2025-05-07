use super::helpers::get_method_arg_names;
use super::instructions::FileInstructions;
use oxc_allocator::Allocator;
use oxc_ast::ast::MethodDefinition;
use oxc_traverse::{Traverse, TraverseCtx};

use super::helpers::insert_single_statement_into_func::insert_single_statement_into_func;

pub struct Transformer<'a> {
    pub allocator: &'a Allocator,
    pub file_instructions: &'a FileInstructions,
    pub pkg_name: &'a str,
    pub pkg_version: &'a str,
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
            get_method_arg_names::get_method_arg_names(node)
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
                "__instrumentInspectArgs('{}', arguments, '{}', '{}', '{}', this);",
                instruction.identifier, self.pkg_name, self.pkg_version, instruction.name
            ));

            insert_single_statement_into_func(self.allocator, body, 0, source_text);
        }

        // Todo support return value modification
    }
}
