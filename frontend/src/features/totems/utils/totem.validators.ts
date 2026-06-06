import type { TotemFormErrors, TotemFormValues } from "../../../types/totem";
import { normalizeTextInputForSubmit } from "../../../utils/inputNormalization";

export function normalizeTotemFormValues(values: TotemFormValues): TotemFormValues {
    return {
        code: normalizeTextInputForSubmit(values.code),
        name: normalizeTextInputForSubmit(values.name),
        campusId: values.campusId,
        state: values.state,
    }
}

export function validateTotemForm(values: TotemFormValues): TotemFormErrors {
    const errors: TotemFormErrors = {}

    if (!values.code) {
        errors.code = 'El código es obligatorio'
    } else if (values.code.length < 3) {
        errors.code = 'El código debe tener mínimo 3 caracteres'
    } else if (values.code.length > 50) {
        errors.code = 'El código debe tener máximo 50 caracteres'
    }

    if (!values.name) {
        errors.name = 'El nombre es obligatorio'
    } else if (values.name.length < 3) {
        errors.name = 'El nombre debe tener mínimo 3 caracteres'
    } else if (values.name.length > 100) {
        errors.name = 'El nombre debe tener máximo 100 caracteres'
    }

    if (!values.campusId) {
        errors.campusId = 'El campus es obligatorio'
    } else {
        const parsedCampusId = Number(values.campusId)

        if (!Number.isInteger(parsedCampusId) || parsedCampusId <= 0) {
            errors.campusId = 'Selecciona un campus válido'
        }
    }

    if (!values.state) {
        errors.state = 'El estado es obligatorio'
    } else if (values.state !== 'active' && values.state !== 'inactive') {
        errors.state = 'El estado solo puede ser activo o inactivo'
    }

    return errors
}
