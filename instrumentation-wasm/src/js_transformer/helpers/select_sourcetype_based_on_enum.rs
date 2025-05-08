use oxc_span::SourceType;

/*
0 -> JS, auto-detect CJS or ESM
1 -> TypeScript (ESM)
2 -> CJS
3 -> MJS (ESM)
4 -> TSX
Default -> JS, auto-detect CJS or ESM
*/
pub fn select_sourcetype_based_on_enum(src_type: i32) -> SourceType {
    // 0 is generic type.
    match src_type {
        0 => SourceType::unambiguous(),
        1 => SourceType::ts(),
        2 => SourceType::cjs(),
        3 => SourceType::mjs(),
        4 => SourceType::tsx(),
        _ => SourceType::unambiguous(),
    }
}
