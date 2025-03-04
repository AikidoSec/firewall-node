use oxc_ast::ast::MethodDefinition;

pub fn get_method_arg_names(method_definition: &MethodDefinition) -> Vec<String> {
    let mut arg_names = Vec::new();

    // Todo check whats appens if rest parameter is used

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
