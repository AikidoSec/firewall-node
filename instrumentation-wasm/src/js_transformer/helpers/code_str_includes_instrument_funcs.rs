const INSTRUMENT_FUNC_NAMES: [&str; 5] = [
    "__instrumentInspectArgs",
    "__instrumentModifyArgs",
    "__instrumentModifyReturnValue",
    "__instrumentShortCircuit",
    "__instrumentAccessLocalVariables",
];

pub fn code_str_includes_instrument_funcs(code: &str) -> bool {
    INSTRUMENT_FUNC_NAMES.iter().any(|name| code.contains(name))
}
