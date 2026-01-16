use oxc_allocator::{Allocator, Box, Vec as OxcVec};
use oxc_ast::{
    AstBuilder, NONE,
    ast::{
        Argument, ArrayExpressionElement, AssignmentOperator, AssignmentTarget, Expression,
        FunctionBody, Statement,
    },
};
use oxc_span::SPAN;

// Add a statement to the beginning of the function: __instrumentInspectArgs('function_identifier', arguments, "{pkg_version}", this);
pub fn insert_inspect_args<'a>(
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    identifier: &str,
    pkg_version: &'a str,
    body: &mut Box<'a, FunctionBody<'a>>,
    is_constructor: bool,
) {
    let mut inspect_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(4);

    // Add the identifier to the arguments
    inspect_args.push(Argument::StringLiteral(builder.alloc_string_literal(
        SPAN,
        allocator.alloc_str(identifier),
        None,
    )));

    // Add the arguments object as the second argument
    inspect_args.push(builder.expression_identifier(SPAN, "arguments").into());

    // Add the package version as the third argument
    inspect_args.push(Argument::StringLiteral(builder.alloc_string_literal(
        SPAN,
        allocator.alloc_str(pkg_version),
        None,
    )));

    // Add the `this` context as the fourth argument
    inspect_args.push(builder.expression_identifier(SPAN, "this").into());

    // Build and add a call expression
    let call_expr = builder.expression_call(
        SPAN,
        builder.expression_identifier(SPAN, "__instrumentInspectArgs"),
        NONE,
        inspect_args,
        false,
    );

    let stmt_expression = builder.statement_expression(SPAN, call_expr);

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
    body: &mut Box<'a, FunctionBody<'a>>,
    modify_arguments_object: bool,
    is_constructor: bool,
) {
    if modify_arguments_object {
        // If we are modifying the arguments object, we need to use the arguments object directly
        // instead of the individual arguments
        // Object.assign(arguments, __instrumentModifyArgs('id', Array.from(arguments)));

        let mut obj_assign_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(2);

        // First argument is the arguments object
        obj_assign_args.push(builder.expression_identifier(SPAN, "arguments").into());

        // Second argument is the call to __instrumentModifyArgs

        let mut instrument_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(2);
        // Add the identifier to the arguments
        instrument_args.push(Argument::StringLiteral(builder.alloc_string_literal(
            SPAN,
            allocator.alloc_str(identifier),
            None,
        )));

        let mut array_from_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(1);
        // Add the arguments object as the first argument to Array.from
        array_from_args.push(builder.expression_identifier(SPAN, "arguments").into());

        let array_from_call = builder.expression_call(
            SPAN,
            Expression::StaticMemberExpression(builder.alloc_static_member_expression(
                SPAN,
                builder.expression_identifier(SPAN, "Array"),
                builder.identifier_name(SPAN, "from"),
                false,
            )),
            NONE,
            array_from_args,
            false,
        );

        instrument_args.push(array_from_call.into());

        // Add the `this` context as argument
        instrument_args.push(builder.expression_identifier(SPAN, "this").into());

        let instrument_modify_args_call = builder.expression_call(
            SPAN,
            builder.expression_identifier(SPAN, "__instrumentModifyArgs"),
            NONE,
            instrument_args,
            false,
        );

        obj_assign_args.push(instrument_modify_args_call.into());

        let obj_assign_call_expr = builder.expression_call(
            SPAN,
            Expression::StaticMemberExpression(builder.alloc_static_member_expression(
                SPAN,
                builder.expression_identifier(SPAN, "Object"),
                builder.identifier_name(SPAN, "assign"),
                false,
            )),
            NONE,
            obj_assign_args,
            false,
        );

        let stmt_expression = builder.statement_expression(SPAN, obj_assign_call_expr);

        let insert_pos = get_insert_pos(body, is_constructor);
        body.statements.insert(insert_pos, stmt_expression);
        return;
    }

    if arg_names.is_empty() {
        // If there are no arguments to modify, we can skip the modification
        return;
    }

    use oxc_ast::ast::AssignmentTargetMaybeDefault;

    let mut array_assignment_target_identifiers: OxcVec<
        'a,
        Option<AssignmentTargetMaybeDefault<'a>>,
    > = builder.vec_with_capacity(arg_names.len());

    for name in arg_names {
        array_assignment_target_identifiers.push(Some(
            AssignmentTargetMaybeDefault::AssignmentTargetIdentifier(
                builder.alloc_identifier_reference(SPAN, allocator.alloc_str(name)),
            ),
        ));
    }

    let mut instrument_modify_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(2);
    // Add the identifier to the arguments
    instrument_modify_args.push(Argument::StringLiteral(builder.alloc_string_literal(
        SPAN,
        allocator.alloc_str(identifier),
        None,
    )));

    let mut instrument_modify_args_array_elements: OxcVec<'a, ArrayExpressionElement<'a>> =
        builder.vec_with_capacity(arg_names.len());

    for name in arg_names {
        instrument_modify_args_array_elements.push(ArrayExpressionElement::Identifier(
            builder.alloc_identifier_reference(SPAN, allocator.alloc_str(name)),
        ));
    }

    instrument_modify_args.push(Argument::ArrayExpression(
        builder.alloc_array_expression(SPAN, instrument_modify_args_array_elements),
    ));

    // Add the `this` context as argument
    instrument_modify_args.push(builder.expression_identifier(SPAN, "this").into());

    let instrument_modify_args_call = builder.expression_call(
        SPAN,
        builder.expression_identifier(SPAN, "__instrumentModifyArgs"),
        NONE,
        instrument_modify_args,
        false,
    );

    let arr_assignment_expr = builder.expression_assignment(
        SPAN,
        AssignmentOperator::Assign,
        AssignmentTarget::ArrayAssignmentTarget(builder.alloc_array_assignment_target(
            SPAN,
            array_assignment_target_identifiers,
            NONE,
        )),
        instrument_modify_args_call,
    );

    let stmt_expression = builder.statement_expression(SPAN, arr_assignment_expr);

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
    let mut instrument_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(2);

    // Add the identifier to the arguments
    instrument_args.push(Argument::StringLiteral(builder.alloc_string_literal(
        SPAN,
        allocator.alloc_str(identifier),
        None,
    )));

    // [var1, var2]
    let mut array_elements: OxcVec<'a, ArrayExpressionElement<'a>> =
        builder.vec_with_capacity(var_names.len());
    for name in var_names {
        array_elements.push(ArrayExpressionElement::Identifier(
            builder.alloc_identifier_reference(SPAN, allocator.alloc_str(name)),
        ));
    }

    instrument_args.push(Argument::ArrayExpression(
        builder.alloc_array_expression(SPAN, array_elements),
    ));

    // Build and add a call expression
    let call_expr = builder.expression_call(
        SPAN,
        builder.expression_identifier(SPAN, "__instrumentAccessLocalVariables"),
        NONE,
        instrument_args,
        false,
    );

    let stmt_expression = builder.statement_expression(SPAN, call_expr);

    body.push(stmt_expression);
}

// Add a statement to the end of the body: __instrumentPackageLoaded('name', 'version');
pub fn insert_package_loaded<'a>(
    allocator: &'a Allocator,
    builder: &'a AstBuilder,
    pkg_name: &str,
    pkg_version: &str,
    body: &mut OxcVec<'a, Statement<'a>>,
) {
    let mut instrument_args: OxcVec<'a, Argument<'a>> = builder.vec_with_capacity(2);

    instrument_args.push(Argument::StringLiteral(builder.alloc_string_literal(
        SPAN,
        allocator.alloc_str(pkg_name),
        None,
    )));

    instrument_args.push(Argument::StringLiteral(builder.alloc_string_literal(
        SPAN,
        allocator.alloc_str(pkg_version),
        None,
    )));

    // Build and add a call expression
    let call_expr = builder.expression_call(
        SPAN,
        builder.expression_identifier(SPAN, "__instrumentPackageLoaded"),
        NONE,
        instrument_args,
        false,
    );

    let stmt_expression = builder.statement_expression(SPAN, call_expr);

    body.push(stmt_expression);
}
