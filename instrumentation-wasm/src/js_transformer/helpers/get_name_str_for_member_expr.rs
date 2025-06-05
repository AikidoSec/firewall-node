use oxc_allocator::Allocator;
use oxc_ast::ast::{Expression, MemberExpression};

pub fn get_name_str_for_member_expr<'a>(
    allocator: &'a Allocator,
    member_expr: &MemberExpression,
) -> Option<&'a str> {
    let prop_name_str = match member_expr {
        MemberExpression::StaticMemberExpression(static_member_expr) => {
            static_member_expr.property.name.as_str()
        }
        MemberExpression::ComputedMemberExpression(computed_member_expr) => {
            match &computed_member_expr.expression {
                Expression::Identifier(identifier_ref) => identifier_ref.name.as_str(),
                _ => {
                    // Unsupported AST type
                    return None;
                }
            }
        }
        _ => {
            // Unsupported AST type
            return None;
        }
    };

    let obj_name_str = match member_expr.object() {
        Expression::Identifier(identifier_ref) => identifier_ref.name.as_str(),
        _ => {
            // Unsupported AST type
            return None;
        }
    };

    if obj_name_str.is_empty() || prop_name_str.is_empty() {
        return None;
    }

    if member_expr.is_computed() {
        return Some(allocator.alloc_str(&format!("{}[{}]", obj_name_str, prop_name_str)));
    }

    Some(allocator.alloc_str(&format!("{}.{}", obj_name_str, prop_name_str)))
}
