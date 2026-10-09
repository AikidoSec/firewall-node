use oxc_allocator::{Allocator, Vec as OxcVec};
use oxc_ast::ast::{
    Argument, ArrayAssignmentTarget, ArrayExpression, ArrayExpressionElement, AssignmentOperator,
    AssignmentTarget, AssignmentTargetMaybeDefault, Expression, FunctionBody, IdentifierName,
    IdentifierReference, Statement, StringLiteral,
};
use oxc_ast::builder::AstBuilder;
use oxc_span::SPAN;

// Add a statement to the beginning of the function: __instrumentInspectArgs('function_identifier', arguments, "{pkg_version}", this);
pub fn insert_inspect_args<'a>(
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    identifier: &str,
    pkg_version: &'a str,
    body: &mut FunctionBody<'a>,
    is_constructor: bool,
) {
    let mut inspect_args: OxcVec<'a, Argument<'a>> = OxcVec::with_capacity_in(4, &allocator);

    // Add the identifier to the arguments
    inspect_args.push(Argument::StringLiteral(StringLiteral::boxed(
        SPAN,
        allocator.alloc_str(identifier),
        None,
        builder,
    )));

    // Add the arguments object as the second argument
    inspect_args.push(
        Expression::Identifier(IdentifierReference::boxed(SPAN, "arguments", builder)).into(),
    );

    // Add the package version as the third argument
    inspect_args.push(Argument::StringLiteral(StringLiteral::boxed(
        SPAN,
        allocator.alloc_str(pkg_version),
        None,
        builder,
    )));

    // Add the `this` context as the fourth argument
    inspect_args
        .push(Expression::Identifier(IdentifierReference::boxed(SPAN, "this", builder)).into());

    // Build and add a call expression
    let call_expr = Expression::new_call_expression(
        SPAN,
        Expression::Identifier(IdentifierReference::boxed(
            SPAN,
            "__instrumentInspectArgs",
            builder,
        )),
        None,
        inspect_args,
        false,
        builder,
    );

    let stmt_expression = Statement::new_expression_statement(SPAN, call_expr, builder);

    let insert_pos = get_insert_pos(body, is_constructor);
    body.statements.insert(insert_pos, stmt_expression);
}

// Modify the arguments by adding a statement to the beginning of the function
// [arg1, arg2, ...] = __instrumentModifyArgs('function_identifier', [arg1, arg2, ...], this);
pub fn insert_modify_args<'a>(
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    identifier: &str,
    arg_names: &Vec<String>,
    body: &mut FunctionBody<'a>,
    modify_arguments_object: bool,
    is_constructor: bool,
) {
    if modify_arguments_object {
        // If we are modifying the arguments object, we need to use the arguments object directly
        // instead of the individual arguments
        // Object.assign(arguments, __instrumentModifyArgs('id', Array.from(arguments)));

        let mut obj_assign_args: OxcVec<'a, Argument<'a>> = OxcVec::with_capacity_in(2, &allocator);

        // First argument is the arguments object
        obj_assign_args.push(
            Expression::Identifier(IdentifierReference::boxed(SPAN, "arguments", builder)).into(),
        );

        // Second argument is the call to __instrumentModifyArgs

        let mut instrument_args: OxcVec<'a, Argument<'a>> = OxcVec::with_capacity_in(2, &allocator);
        // Add the identifier to the arguments
        instrument_args.push(Argument::StringLiteral(StringLiteral::boxed(
            SPAN,
            allocator.alloc_str(identifier),
            None,
            builder,
        )));

        let mut array_from_args: OxcVec<'a, Argument<'a>> = OxcVec::with_capacity_in(1, &allocator);
        // Add the arguments object as the first argument to Array.from
        array_from_args.push(
            Expression::Identifier(IdentifierReference::boxed(SPAN, "arguments", builder)).into(),
        );

        let array_from_call = Expression::new_call_expression(
            SPAN,
            Expression::new_static_member_expression(
                SPAN,
                Expression::Identifier(IdentifierReference::boxed(SPAN, "Array", builder)),
                IdentifierName::new(SPAN, "from", builder),
                false,
                builder,
            ),
            None,
            array_from_args,
            false,
            builder,
        );

        instrument_args.push(array_from_call.into());

        // Add the `this` context as argument
        instrument_args
            .push(Expression::Identifier(IdentifierReference::boxed(SPAN, "this", builder)).into());

        let instrument_modify_args_call = Expression::new_call_expression(
            SPAN,
            Expression::Identifier(IdentifierReference::boxed(
                SPAN,
                "__instrumentModifyArgs",
                builder,
            )),
            None,
            instrument_args,
            false,
            builder,
        );

        obj_assign_args.push(instrument_modify_args_call.into());

        let obj_assign_call_expr = Expression::new_call_expression(
            SPAN,
            Expression::new_static_member_expression(
                SPAN,
                Expression::Identifier(IdentifierReference::boxed(SPAN, "Object", builder)),
                IdentifierName::new(SPAN, "assign", builder),
                false,
                builder,
            ),
            None,
            obj_assign_args,
            false,
            builder,
        );

        let stmt_expression =
            Statement::new_expression_statement(SPAN, obj_assign_call_expr, builder);

        let insert_pos = get_insert_pos(body, is_constructor);
        body.statements.insert(insert_pos, stmt_expression);
        return;
    }

    if arg_names.is_empty() {
        // If there are no arguments to modify, we can skip the modification
        return;
    }

    let mut array_assignment_target_identifiers: OxcVec<
        'a,
        Option<AssignmentTargetMaybeDefault<'a>>,
    > = OxcVec::with_capacity_in(arg_names.len(), &allocator);

    for name in arg_names {
        array_assignment_target_identifiers.push(Some(
            AssignmentTargetMaybeDefault::AssignmentTargetIdentifier(IdentifierReference::boxed(
                SPAN,
                allocator.alloc_str(name),
                builder,
            )),
        ));
    }

    let mut instrument_modify_args: OxcVec<'a, Argument<'a>> =
        OxcVec::with_capacity_in(2, &allocator);
    // Add the identifier to the arguments
    instrument_modify_args.push(Argument::StringLiteral(StringLiteral::boxed(
        SPAN,
        allocator.alloc_str(identifier),
        None,
        builder,
    )));

    let mut instrument_modify_args_array_elements: OxcVec<'a, ArrayExpressionElement<'a>> =
        OxcVec::with_capacity_in(arg_names.len(), &allocator);

    for name in arg_names {
        instrument_modify_args_array_elements.push(ArrayExpressionElement::Identifier(
            IdentifierReference::boxed(SPAN, allocator.alloc_str(name), builder),
        ));
    }

    instrument_modify_args.push(Argument::ArrayExpression(ArrayExpression::boxed(
        SPAN,
        instrument_modify_args_array_elements,
        builder,
    )));

    // Add the `this` context as argument
    instrument_modify_args
        .push(Expression::Identifier(IdentifierReference::boxed(SPAN, "this", builder)).into());

    let instrument_modify_args_call = Expression::new_call_expression(
        SPAN,
        Expression::Identifier(IdentifierReference::boxed(
            SPAN,
            "__instrumentModifyArgs",
            builder,
        )),
        None,
        instrument_modify_args,
        false,
        builder,
    );

    let arr_assignment_expr = Expression::new_assignment_expression(
        SPAN,
        AssignmentOperator::Assign,
        AssignmentTarget::ArrayAssignmentTarget(ArrayAssignmentTarget::boxed(
            SPAN,
            array_assignment_target_identifiers,
            None,
            builder,
        )),
        instrument_modify_args_call,
        builder,
    );

    let stmt_expression = Statement::new_expression_statement(SPAN, arr_assignment_expr, builder);

    let insert_pos = get_insert_pos(body, is_constructor);
    body.statements.insert(insert_pos, stmt_expression);
}

// Determine the position to insert the code in the function body.
// If it's a constructor, we look for the first super call and insert after it.
fn get_insert_pos(body: &FunctionBody, is_constructor: bool) -> usize {
    if !is_constructor || body.statements.is_empty() {
        0
    } else {
        for (index, statement) in (&body.statements).into_iter().enumerate() {
            if let Statement::ExpressionStatement(expr_stmt) = statement
                && let Expression::CallExpression(call_expr) = &expr_stmt.expression
                && let Expression::Super(_) = &call_expr.callee
            {
                // Found a super call, insert after this statement
                return index + 1; // Insert after the super call
            }
        }
        0 // No super call found, insert at the beginning
    }
}

// Add a statement to the end of the body: __instrumentAccessLocalVariables('identifier', [var1, var2]);
pub fn insert_access_local_var<'a>(
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    identifier: &str,
    var_names: &Vec<String>,
    body: &mut OxcVec<'a, Statement<'a>>,
) {
    let mut instrument_args: OxcVec<'a, Argument<'a>> = OxcVec::with_capacity_in(2, &allocator);

    // Add the identifier to the arguments
    instrument_args.push(Argument::StringLiteral(StringLiteral::boxed(
        SPAN,
        allocator.alloc_str(identifier),
        None,
        builder,
    )));

    // [var1, var2]
    let mut array_elements: OxcVec<'a, ArrayExpressionElement<'a>> =
        OxcVec::with_capacity_in(var_names.len(), &allocator);
    for name in var_names {
        array_elements.push(ArrayExpressionElement::Identifier(
            IdentifierReference::boxed(SPAN, allocator.alloc_str(name), builder),
        ));
    }

    instrument_args.push(Argument::ArrayExpression(ArrayExpression::boxed(
        SPAN,
        array_elements,
        builder,
    )));

    // Build and add a call expression
    let call_expr = Expression::new_call_expression(
        SPAN,
        Expression::Identifier(IdentifierReference::boxed(
            SPAN,
            "__instrumentAccessLocalVariables",
            builder,
        )),
        None,
        instrument_args,
        false,
        builder,
    );

    let stmt_expression = Statement::new_expression_statement(SPAN, call_expr, builder);

    body.push(stmt_expression);
}
