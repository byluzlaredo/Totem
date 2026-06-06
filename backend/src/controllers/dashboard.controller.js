import dashboardService from '../services/dashboard.service.js'

export async function getDashboardSummary(req, res) {
  const data = await dashboardService.getDashboardSummary(req.authUser)

  res.status(200).json({
    ok: true,
    data,
  })
}
