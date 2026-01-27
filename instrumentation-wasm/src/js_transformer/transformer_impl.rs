use oxc_allocator::Allocator;
use oxc_ast::ast::{AssignmentOperator, Expression, FunctionType, MethodDefinition};
use oxc_traverse::{Traverse, TraverseCtx};

use super::helpers::{
    get_arg_names::get_function_or_method_arg_names,
    get_name_str_for_member_expr::get_name_str_for_member_expr,
    insert_instrument_method_calls::insert_instrument_method_calls,
};
use super::instructions::FileInstructions;

pub struct Transformer<'a> {
    pub allocator: &'a Allocator,
    pub file_instructions: &'a FileInstructions,
    pub pkg_version: &'a str,
    pub ast_builder: &'a oxc_ast::AstBuilder<'a>,
}

pub struct TraverseState {}

impl<'a> Traverse<'a, TraverseState> for Transformer<'a> {
    fn enter_method_definition(
        &mut self,
        node: &mut MethodDefinition<'a>,
        _ctx: &mut TraverseCtx<'a, TraverseState>,
    ) {
        if !node.key.is_identifier() || node.value.body.is_none() || node.key.name().is_none() {
            return;
        }

        if !node.kind.is_method() && !node.kind.is_constructor() {
            // Ignore getters and setters for now
            return;
        }

        let method_name = node.key.name().unwrap().to_string();

        let matching_instruction = self
            .file_instructions
            .functions
            .iter()
            .find(|f| f.node_type == "MethodDefinition" && f.name == method_name);

        if matching_instruction.is_none() {
            return;
        }

        let instruction = matching_instruction.unwrap();

        // We need to collect the arg names before we make the body mutable
        let arg_names = if instruction.modify_args {
            get_function_or_method_arg_names(&node.value.params)
        } else {
            Vec::new()
        };

        let body = node.value.body.as_mut().unwrap();

        insert_instrument_method_calls(
            self.allocator,
            self.ast_builder,
            instruction,
            &arg_names,
            self.pkg_version,
            body,
            node.kind.is_constructor(),
        );
    }

    fn enter_assignment_expression(
        &mut self,
        node: &mut oxc_ast::ast::AssignmentExpression<'a>,
        _ctx: &mut TraverseCtx<'a, TraverseState>,
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

        let function_args = match &mut node.right {
            Expression::FunctionExpression(func_expr) => &func_expr.params,
            Expression::ArrowFunctionExpression(arrow_func_expr) => &arrow_func_expr.params,
            _ => return,
        };

        // We need to collect the arg names before we make the body mutable
        let arg_names = if instruction.modify_args {
            get_function_or_method_arg_names(function_args)
        } else {
            Vec::new()
        };

        let body: &mut oxc_allocator::Box<'_, oxc_ast::ast::FunctionBody<'_>> =
            match &mut node.right {
                Expression::FunctionExpression(func_expr) => func_expr.body.as_mut().unwrap(),
                Expression::ArrowFunctionExpression(arrow_func_expr) => &mut arrow_func_expr.body,
                _ => return,
            };

        insert_instrument_method_calls(
            self.allocator,
            self.ast_builder,
            instruction,
            &arg_names,
            self.pkg_version,
            body,
            false,
        );
    }

    fn enter_function(
        &mut self,
        node: &mut oxc_ast::ast::Function<'a>,
        _ctx: &mut TraverseCtx<'a, TraverseState>,
    ) {
        let node_type = match node.r#type {
            FunctionType::FunctionDeclaration => "FunctionDeclaration",
            FunctionType::FunctionExpression => "FunctionExpression",
            _ => {
                // Ignore unknown function types
                return;
            }
        };

        if node.id.is_none() || node.body.is_none() {
            // No identifier or body, nothing to instrument
            return;
        }

        let function_id = node.id.as_ref().unwrap();

        let function_name = function_id.name.to_string();

        let matching_instruction = self
            .file_instructions
            .functions
            .iter()
            .find(|f| f.node_type == node_type && f.name == function_name);

        if matching_instruction.is_none() {
            return;
        }

        let instruction = matching_instruction.unwrap();

        // We need to collect the arg names before we make the body mutable
        let arg_names = if instruction.modify_args {
            get_function_or_method_arg_names(&node.params)
        } else {
            Vec::new()
        };

        let body = node.body.as_mut().unwrap();

        insert_instrument_method_calls(
            self.allocator,
            self.ast_builder,
            instruction,
            &arg_names,
            self.pkg_version,
            body,
            false,
        );
    }

    fn enter_variable_declarator(
        &mut self,
        node: &mut oxc_ast::ast::VariableDeclarator<'a>,
        _ctx: &mut TraverseCtx<'a, TraverseState>,
    ) {
        if !node.id.kind.is_binding_identifier() || node.init.is_none() {
            return;
        }

        let expr = node.init.as_mut().unwrap();
        if !expr.is_function() {
            return;
        }

        let name_str = node.id.get_identifier_name().unwrap().to_string();

        let matching_instruction = self
            .file_instructions
            .functions
            .iter()
            .find(|f| f.node_type == "FunctionVariableDeclaration" && f.name == name_str);

        if matching_instruction.is_none() {
            // This variable declaration should not be instrumented
            return;
        }

        let instruction = matching_instruction.unwrap();

        let function_args = match expr {
            Expression::FunctionExpression(func_expr) => &func_expr.params,
            Expression::ArrowFunctionExpression(arrow_func_expr) => &arrow_func_expr.params,
            _ => return,
        };

        // We need to collect the arg names before we make the body mutable
        let arg_names = if instruction.modify_args {
            get_function_or_method_arg_names(function_args)
        } else {
            Vec::new()
        };

        let body: &mut oxc_allocator::Box<'_, oxc_ast::ast::FunctionBody<'_>> = match expr {
            Expression::FunctionExpression(func_expr) => func_expr.body.as_mut().unwrap(),
            Expression::ArrowFunctionExpression(arrow_func_expr) => &mut arrow_func_expr.body,
            _ => return,
        };

        insert_instrument_method_calls(
            self.allocator,
            self.ast_builder,
            instruction,
            &arg_names,
            self.pkg_version,
            body,
            false,
        );
    }
}
