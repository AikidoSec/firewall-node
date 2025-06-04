use oxc_span::SourceType;

pub fn get_import_code_str(source_type: &SourceType, has_module_syntax: bool) -> &'static str {
    // Todo maybe import only needed functions, not sure if it is worth it
    if source_type.is_script() || source_type.is_unambiguous() && !has_module_syntax {
        return "const { __instrumentInspectArgs, __instrumentModifyArgs, __instrumentModifyReturnValue } = require('@aikidosec/firewall/instrument/internals');";
    }

    "import { __instrumentInspectArgs, __instrumentModifyArgs, __instrumentModifyReturnValue } from '@aikidosec/firewall/instrument/internals';"
}
