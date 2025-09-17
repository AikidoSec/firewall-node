use oxc_ast::ast::{FormalParameters, MethodDefinition};

pub fn get_method_arg_names(method_definition: &MethodDefinition) -> Vec<String> {
    let mut arg_names = Vec::new();

    method_definition
        .value
        .params
        .items
        .iter()
        .for_each(|param| {
            arg_names.push(param.pattern.get_identifier_name().unwrap().to_string());
        });

    arg_names
}

pub fn get_function_arg_names(params: &oxc_allocator::Box<FormalParameters>) -> Vec<String> {
    let mut arg_names = Vec::new();

    params.items.iter().for_each(|param| {
        arg_names.push(param.pattern.get_identifier_name().unwrap().to_string());
    });

    arg_names
}
