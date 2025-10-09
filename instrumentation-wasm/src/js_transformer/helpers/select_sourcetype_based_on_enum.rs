use oxc_span::SourceType;

pub fn select_sourcetype_based_on_enum(src_type: &str) -> SourceType {
    // 0 is generic type.
    match src_type {
        "unambiguous" => SourceType::unambiguous(),
        "ts" => SourceType::ts(),
        "cjs" => SourceType::cjs(),
        "mjs" => SourceType::mjs(),
        "tsx" => SourceType::tsx(),
        "jsx" => SourceType::jsx(),
        _ => SourceType::unambiguous(),
    }
}
