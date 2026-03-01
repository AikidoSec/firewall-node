use wasm_bindgen::prelude::*;

use crate::js_transformer::transformer::transform_code_str;
use crate::js_transformer::user_code_transformer::transform_user_code_str;

#[wasm_bindgen]
pub fn wasm_transform_code_str(
    pkg_name: &str,
    pkg_version: &str,
    code: &str,
    instructions_json: &str,
    source_type: &str,
) -> Result<String, String> {
    transform_code_str(pkg_name, pkg_version, code, instructions_json, source_type)
}

#[wasm_bindgen]
pub fn wasm_transform_user_code(code: &str, source_type: &str) -> Result<String, String> {
    transform_user_code_str(code, source_type)
}
