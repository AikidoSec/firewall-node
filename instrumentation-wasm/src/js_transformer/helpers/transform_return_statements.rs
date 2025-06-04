use oxc_allocator::{Allocator, Box, Vec};
use oxc_ast::{
    ast::{Argument, FunctionBody, Statement},
    AstBuilder, NONE,
};
use oxc_span::SPAN;

pub fn transform_return_statements<'a>(
    allocator: &'a Allocator,
    builder: &AstBuilder<'a>,
    identifier: &str,
    body: &mut Box<'a, FunctionBody<'a>>,
) {
    // Iterate through the statements in the function body
    for statement in &mut body.statements {
        match statement {
            Statement::ReturnStatement(return_stmt) => {
                let mut instrument_args: Vec<'a, Argument<'a>> = builder.vec_with_capacity(2);

                // Add the identifier to the arguments
                instrument_args.push(Argument::StringLiteral(builder.alloc_string_literal(
                    SPAN,
                    allocator.alloc_str(identifier),
                    None,
                )));
                // Add original return value as the second argument
                let arg_expr = return_stmt
                    .argument
                    .take()
                    .unwrap_or_else(|| builder.expression_identifier(SPAN, "undefined"));
                instrument_args.push(arg_expr.into());

                let new_call_expr = builder.expression_call(
                    SPAN,
                    builder.expression_identifier(SPAN, "__instrumentModifyReturnValue"),
                    NONE,
                    instrument_args,
                    false,
                );

                // Replace the return statement with a call to the identifier
                return_stmt.argument = Some(new_call_expr);
            }
            _ => {
                // Ignore
                continue;
            }
        }
    }
}
