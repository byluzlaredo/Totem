import campusService from '../services/campus.service.js'

export async function listCampuses(req, res) {
  const data = await campusService.listCampusOptions(req.authUser)

  res.status(200).json({
    ok: true,
    data,
  })
}
