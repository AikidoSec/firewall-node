use wasm_bindgen::prelude::*;

use crate::js_transformer::{
    transform_insert_sca::transform_code_str_insert_sca, transformer::transform_code_str,
};

#[wasm_bindgen]
pub fn wasm_transform_code_str(
    pkg_name: &str,
    pkg_version: &str,
    code: &str,
    instructions_json: &str,
    source_type: &str,
    is_bundling: bool,
) -> Result<String, String> {
    transform_code_str(
        pkg_name,
        pkg_version,
        code,
        instructions_json,
        source_type,
        is_bundling,
    )
}

#[wasm_bindgen]
pub fn wasm_transform_code_str_insert_sca(
    pkg_name: &str,
    pkg_version: &str,
    code: &str,
    source_type: &str,
) -> Result<String, String> {
    transform_code_str_insert_sca(pkg_name, pkg_version, code, source_type)
}
