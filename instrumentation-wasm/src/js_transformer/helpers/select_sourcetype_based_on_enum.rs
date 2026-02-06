use oxc_span::SourceType;

pub fn select_sourcetype_based_on_enum(src_type: &str) -> SourceType {
    // unambiguous is generic type.
    match src_type {
        "unambiguous" => SourceType::unambiguous(),
        "ts" => SourceType::ts(),
        "cjs" => SourceType::cjs(),
        "mjs" => SourceType::mjs(),
        "tsx" => SourceType::tsx(),
        "jsx" => SourceType::jsx(),
        "cts" => SourceType::ts().with_script(true),
        "mts" => SourceType::ts().with_module(true),
        _ => SourceType::unambiguous(),
    }
}
