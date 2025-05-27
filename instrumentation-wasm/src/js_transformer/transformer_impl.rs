use oxc_allocator::Allocator;
use oxc_ast::ast::{AssignmentOperator, Expression, MethodDefinition};
use oxc_traverse::{Traverse, TraverseCtx};

use super::helpers::{
    get_arg_names::get_function_arg_names,
    get_arg_names::get_method_arg_names,
    get_name_str_for_member_expr::get_name_str_for_member_expr,
    insert_code::{insert_inspect_args, insert_modify_args},
};
use super::instructions::FileInstructions;

pub struct Transformer<'a> {
    pub allocator: &'a Allocator,
    pub file_instructions: &'a FileInstructions,
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
            get_method_arg_names(node)
        } else {
            Vec::new()
        };

        let body = node.value.body.as_mut().unwrap();

        if instruction.modify_args && !arg_names.is_empty() {
            let arg_names_str = arg_names.join(", ");
            insert_modify_args(
                self.allocator,
                &instruction.identifier,
                &arg_names_str,
                body,
                instruction.modify_arguments_object,
            );
        }

        if instruction.inspect_args {
            insert_inspect_args(
                self.allocator,
                &instruction.identifier,
                self.pkg_version,
                body,
            );
        }

        // Todo support return value modification
    }

    fn enter_assignment_expression(
        &mut self,
        node: &mut oxc_ast::ast::AssignmentExpression<'a>,
        _ctx: &mut TraverseCtx<'a>,
    ) {
        if node.operator != AssignmentOperator::Assign {
            // Return if operator is not =
            return;
        }

        if !node.left.is_member_expression() || !node.right.is_function() {
            return;
        }

        let member_expression = node.left.as_member_expression().unwrap();

        let name_str_opt = get_name_str_for_member_expr(self.allocator, member_expression);
        if name_str_opt.is_none() {
            // Could not determine the name of the assignment
            return;
        }
        let name_str = name_str_opt.unwrap();

        let matching_instruction = self
            .file_instructions
            .functions
            .iter()
            .find(|f| f.node_type == "FunctionAssignment" && f.name == name_str);

        if matching_instruction.is_none() {
            // This function assignment should not be instrumented
            return;
        }

        let instruction = matching_instruction.unwrap();

        // We need to modify the function expression
        let function_expression = match &mut node.right {
            Expression::FunctionExpression(func_expr) => func_expr,
            _ => return,
        };

        // We need to collect the arg names before we make the body mutable
        let arg_names = if instruction.modify_args {
            get_function_arg_names(function_expression)
        } else {
            Vec::new()
        };

        let body = function_expression.body.as_mut().unwrap();

        if instruction.modify_args {
            let arg_names_str = arg_names.join(", ");
            insert_modify_args(
                self.allocator,
                &instruction.identifier,
                &arg_names_str,
                body,
                instruction.modify_arguments_object,
            );
        }

        if instruction.inspect_args {
            insert_inspect_args(
                self.allocator,
                &instruction.identifier,
                self.pkg_version,
                body,
            );
        }

        // Todo support return value modification
    }
}
