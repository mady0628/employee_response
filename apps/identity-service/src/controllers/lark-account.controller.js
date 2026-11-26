const repository = require(
  "../repositories/lark-account.repository"
);

async function listVerified(req, res) {
  try {
    const employees =
      await repository.getVerifiedLarkEmployees();

    return res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error(
      "Get verified Lark employees failed:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

module.exports = {
  listVerified
};
