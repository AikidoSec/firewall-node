use oxc_allocator::Allocator;
use oxc_ast::{ast::FunctionBody, builder::AstBuilder};
use oxc_semantic::{ScopeFlags, ScopeId};
use oxc_traverse::TraverseCtx;

use crate::js_transformer::{
    helpers::{
        insert_code::{insert_inspect_args, insert_modify_args, insert_short_circuit},
        transform_return_statements::transform_return_statements,
    },
    instructions::FunctionInstructions,
};

pub fn insert_instrument_method_calls<'a, S>(
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    instruction: &FunctionInstructions,
    arg_names: &Vec<String>,
    pkg_version: &'a str,
    body: &mut FunctionBody<'a>,
    is_constructor: bool,
    // Scope of the instrumented function, used as parent for the scopes of the injected blocks
    function_scope_id: Option<ScopeId>,
    ctx: &mut TraverseCtx<'a, S>,
) {
    // Must run before the other insertions, so the early return of shortCircuit is not wrapped
    if instruction.modify_return_value && !is_constructor {
        transform_return_statements(
            allocator,
            builder,
            &instruction.identifier,
            &mut body.statements,
        );
    }

    if instruction.modify_args && !arg_names.is_empty() {
        insert_modify_args(
            allocator,
            builder,
            &instruction.identifier,
            arg_names,
            body,
            instruction.modify_arguments_object,
            is_constructor,
        );
    }

    // Inserted after modifyArgs and before inspectArgs, so it ends up between them (inspectArgs -> shortCircuit -> modifyArgs)
    if instruction.short_circuit && !is_constructor {
        let parent_scope_id = function_scope_id.unwrap_or_else(|| ctx.current_scope_id());
        let block_scope_id = ctx.create_child_scope(parent_scope_id, ScopeFlags::empty());
        let if_scope_id = ctx.create_child_scope(block_scope_id, ScopeFlags::empty());
        insert_short_circuit(
            allocator,
            builder,
            &instruction.identifier,
            block_scope_id,
            if_scope_id,
            body,
        );
    }

    if instruction.inspect_args {
        insert_inspect_args(
            allocator,
            builder,
            &instruction.identifier,
            pkg_version,
            body,
            is_constructor,
        );
    }
}
