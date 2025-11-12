use oxc_ast::ast::FormalParameters;

pub fn get_function_or_method_arg_names(
    params: &oxc_allocator::Box<FormalParameters>,
) -> Vec<String> {
    let mut arg_names = Vec::new();

    params.items.iter().for_each(|param| {
        arg_names.push(param.pattern.get_identifier_name().unwrap().to_string());
    });

    arg_names
}
