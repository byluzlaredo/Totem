import { RequestValidationError } from '../errors/AppError.js'
import campusRepository from '../repositories/campus.repository.js'
import { requireCampusScopeId } from '../utils/campusAccess.js'

class CampusService {
  async listCampusOptions(authUser = null) {
    const scopedCampusId = requireCampusScopeId(authUser)
    const campuses = scopedCampusId === null
      ? await campusRepository.listAll()
      : await campusRepository.listAll({
        where: {
          id: scopedCampusId,
        },
      })

    return campuses.map((campus) => ({
      id: campus.id,
      name: campus.name,
    }))
  }

  async assertCampusIdExists(campusId, fieldName = 'campusId') {
    const existingCampus = await campusRepository.findById(campusId)

    if (!existingCampus) {
      throw new RequestValidationError('El campus seleccionado no existe', {
        [fieldName]: 'El campus seleccionado no existe',
      })
    }
  }
}

export default new CampusService()
