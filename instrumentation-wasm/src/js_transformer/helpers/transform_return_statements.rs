use oxc_allocator::{Allocator, Vec as OxcVec};
use oxc_ast::{
    AstBuilder, NONE,
    ast::{Argument, Expression, Statement},
};
use oxc_span::SPAN;

pub fn transform_return_statements<'a>(
    allocator: &'a Allocator,
    builder: &AstBuilder<'a>,
    identifier: &str,
    statements: &mut OxcVec<'a, Statement<'a>>,
) {
    transform_statements(allocator, builder, identifier, statements);
}

fn transform_statements<'a>(
    allocator: &'a Allocator,
    builder: &AstBuilder<'a>,
    identifier: &str,
    statements: &mut OxcVec<'a, Statement<'a>>,
) {
    // Iterate through the statements in the function body
    for statement in statements {
        transform_statement(allocator, builder, identifier, statement);
    }
}

fn transform_statement<'a>(
    allocator: &'a Allocator,
    builder: &AstBuilder<'a>,
    identifier: &str,
    statement: &mut Statement<'a>,
) {
    match statement {
        Statement::ReturnStatement(return_stmt) => {
            let mut instrument_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(3);

            // Add the identifier to the arguments
            instrument_args.push(Argument::StringLiteral(builder.alloc_string_literal(
                SPAN,
                allocator.alloc_str(identifier),
                None,
            )));

            // Also pass the function arguments
            instrument_args.push(builder.expression_identifier(SPAN, "arguments").into());

            // Add original return value as the second argument
            let arg_expr = return_stmt
                .argument
                .take()
                .unwrap_or_else(|| builder.expression_identifier(SPAN, "undefined"));

            let needs_await = matches!(arg_expr, Expression::AwaitExpression(_));

            instrument_args.push(arg_expr.into());

            // Add the `this` context as argument
            instrument_args.push(builder.expression_identifier(SPAN, "this").into());

            let new_call_expr = builder.expression_call(
                SPAN,
                builder.expression_identifier(SPAN, "__instrumentModifyReturnValue"),
                NONE,
                instrument_args,
                false,
            );

            if !needs_await {
                // Replace the return statement with a call to the identifier
                return_stmt.argument = Some(new_call_expr);
            } else {
                // If the original return value was awaited, we need to await the new call expression
                return_stmt.argument = Some(builder.expression_await(SPAN, new_call_expr));
            }
        }
        // Recursively transform nested statements
        Statement::BlockStatement(block_stmt) => {
            transform_statements(allocator, builder, identifier, &mut block_stmt.body);
        }
        Statement::IfStatement(if_stmt) => {
            transform_statement(allocator, builder, identifier, &mut if_stmt.consequent);
            if let Some(alt) = &mut if_stmt.alternate {
                transform_statement(allocator, builder, identifier, alt);
            }
        }
        Statement::DoWhileStatement(do_while_stmt) => {
            transform_statement(allocator, builder, identifier, &mut do_while_stmt.body);
        }
        Statement::ForStatement(for_stmt) => {
            transform_statement(allocator, builder, identifier, &mut for_stmt.body);
        }
        Statement::ForInStatement(for_in_stmt) => {
            transform_statement(allocator, builder, identifier, &mut for_in_stmt.body);
        }
        Statement::ForOfStatement(for_of_stmt) => {
            transform_statement(allocator, builder, identifier, &mut for_of_stmt.body);
        }
        Statement::WhileStatement(while_stmt) => {
            transform_statement(allocator, builder, identifier, &mut while_stmt.body);
        }
        Statement::SwitchStatement(switch_stmt) => {
            for case in &mut switch_stmt.cases {
                transform_statements(allocator, builder, identifier, &mut case.consequent);
            }
        }
        Statement::TryStatement(try_stmt) => {
            transform_statements(allocator, builder, identifier, &mut try_stmt.block.body);
            if let Some(handler) = &mut try_stmt.handler {
                transform_statements(allocator, builder, identifier, &mut handler.body.body);
            }
            if let Some(finally_block) = &mut try_stmt.finalizer {
                transform_statements(allocator, builder, identifier, &mut finally_block.body);
            }
        }
        Statement::LabeledStatement(labeled_stmt) => {
            transform_statement(allocator, builder, identifier, &mut labeled_stmt.body);
        }
        _ => {
            // Ignore
        }
    }
}
