const axios = require("axios");
const model = require("./config/table");
const Validator = require("validatorjs");
const Helper = require("./helpers");
exports.test = async (req, res, next) => {
  try {
    const options = {
      method: "GET",
      url: "https://api.yelp.com/v3/businesses/search",
      params: { location: "NYC", sort_by: "best_match", limit: "20" },
      headers: {
        accept: "application/json",
        Authorization: "Bearer " + process.env.YELP_API_KEY,
      },
    };
    axios(options)
      .then(async function (response) {
        try {
          const data = response.data.businesses;
          if (data.length) {
            await model.query(`START TRANSACTION`);
            for await (const d of data) {
              await model.execute(`
                INSERT INTO businesses(id, alias, name, image_url, review_count, rating, price, phone, distance, display_phone) VALUES
                (
                  "${d.id}",
                  "${d.alias}",
                  "${d.name}",
                  "${d.image_url}",
                  "${d.review_count}",
                  "${d.rating}",
                  "${d.price}",
                  "${d.phone}",
                  "${d.distance}",
                  "${d.display_phone}"
                )
                `);
              if (d.categories.length) {
                for await (const c of d.categories) {
                  let [check] = await model.query(
                    `SELECT * FROM categories WHERE alias = "${c.alias}" LIMIT 1`
                  );
                  if (!check.length) {
                    await model.execute(`
                      INSERT INTO categories(id, alias, title) VALUES
                      (
                        "${Helper.getId()}",
                        "${c.alias}",
                        "${c.title}"
                      )
                      `);
                    let [data] = await model.query(
                      `SELECT * FROM categories WHERE alias = "${c.alias}" LIMIT 1`
                    );
                    await model.execute(`
                      INSERT INTO bussinesses_categories(id, business_id, category_id) VALUES
                      (
                        "${Helper.getId()}",
                        "${d.id}",
                        "${data[0].id}"
                      )
                      `);
                  } else {
                    await model.execute(`
                        INSERT INTO bussinesses_categories(id, business_id, category_id) VALUES
                        (
                            "${Helper.getId()}",
                            "${d.id}",
                            "${check[0].id}"
                        )
                        `);
                  }
                }
              }
              if (d.transactions.length) {
                for await (let t of d.transactions) {
                  let [check] = await model.query(
                    `SELECT * FROM transactions WHERE name = "${t}" LIMIT 1`
                  );
                  if (!check.length) {
                    await model.execute(`
                            INSERT INTO transactions(id, name) VALUES
                            (
                                "${Helper.getId()}",
                                "${t}"
                            )
                            `);
                    let [data] = await model.query(
                      `SELECT * FROM transactions WHERE name = "${t}" LIMIT 1`
                    );
                    await model.execute(`
                            INSERT INTO bussinesses_transactions(id, business_id, transaction_id) VALUES
                            (
                                "${Helper.getId()}",
                                "${d.id}",
                                "${data[0].id}"
                            )
                            `);
                  } else {
                    await model.execute(`
                            INSERT INTO bussinesses_transactions(id, business_id, transaction_id) VALUES
                            (
                                "${Helper.getId()}",
                                "${d.id}",
                                "${check[0].id}"
                            )
                            `);
                  }
                }
              }
            }
          }
          await model.execute(`COMMIT;`);

          res.json({
            code: 200,
            status: "success",
            message: "success",
            result: [],
          });
        } catch (error) {
          await model.execute(`ROLLBACK;`);

          console.log(error);
        }
      })
      .catch(async function (error) {
        console.error(error, "errorss");
      });
  } catch (error) {}
};

exports.postBusiness = async (req, res, next) => {
  let {
    alias,
    name,
    image_url,
    price,
    phone,
    display_phone,
    categories,
    transactions,
  } = req.body;
  let id = Helper.getId();
  let rules = {
    alias: "required",
    name: "required",
    image_url: "required",
    price: "required|check_price",
    phone: "required",
    display_phone: "required",
    categories: "required|check_categories",
  };

  let error_msg = {
    required: ":attribute cannot be null",
    in: "invalid :attribute",
  };

  let validation = new Validator(
    {
      alias,
      name,
      image_url,
      price,
      phone,
      display_phone,
      categories,
    },
    rules,
    error_msg
  );
  Validator.registerAsync(
    "check_price",
    function (price, attribute, req, passes) {
      if (price == "$" || price == "$$" || price == "$$$" || price == "$$$$") {
        passes();
      } else {
        passes(false, "Invalid price.");
      }
    }
  );
  Validator.registerAsync(
    "check_categories",
    function (categories, attribute, req, passes) {
      if (Array.isArray(categories)) {
        if (categories.length) {
          let check = true;
          categories.forEach((e) => {
            let { alias, title } = e;
            if (!alias || !title) {
              check = false;
            }
          });
          if (!check) {
            console.log("disini");
            passes(false, "Invalid categories.");
          } else {
            passes();
          }
        } else {
          passes(false, "business must have at least one categories.");
        }
      } else {
        passes(false, "Invalid categories.");
      }
    }
  );
  validation.checkAsync(passes, fails);
  function fails() {
    let message = [];
    for (var key in validation.errors.all()) {
      var value = validation.errors.all()[key];
      message.push(value[0]);
    }
    return res.status(200).json({
      code: 401,
      status: "error",
      message: message,
      result: [],
    });
  }
  async function passes() {
    try {
      await model.query(`START TRANSACTION;`);
      await model.execute(`
        INSERT INTO businesses(id, alias, name, image_url, price, phone, display_phone) VALUES
        (
            "${id}",
            "${alias}",
            "${name}",
            "${image_url}",
            "${price}",
            "${phone}",
            "${display_phone}"
        )
        `);
      if (categories.length) {
        for await (let c of categories) {
          let [check] = await model.query(
            `SELECT * FROM categories WHERE title = "${c.title}" LIMIT 1`
          );
          if (!check.length) {
            await model.execute(`
                        INSERT INTO categories(id, alias, title) VALUES
                        (
                            "${Helper.getId()}",
                            "${c.alias}",
                            "${c.title}"
                        )
                        `);
            let [data] = await model.query(
              `SELECT * FROM categories WHERE title = "${c.title}" LIMIT 1`
            );
            await model.execute(`
                        INSERT INTO bussinesses_categories(id, business_id, category_id) VALUES
                        (
                            "${Helper.getId()}",
                            "${id}",
                            "${data[0].id}"
                        )
                        `);
          }
        }
      }
      await model.execute(`COMMIT;`);
      res.json({
        code: 201,
        status: "success",
        message: "success",
        result: [],
      });
    } catch (error) {
      err.message = err.message.includes("SQLState")
        ? "Query syntax error."
        : err.message;
      res.json({
        code: 400,
        status: "error",
        message: [err.message],
        result: [],
      });
    }
  }
};

exports.deleteBusiness = async (req, res, next) => {
  let { id } = req.query;
  let rules = {
    id: "required|check_business",
  };

  let error_msg = {
    required: ":attribute cannot be null",
    in: "invalid :attribute",
  };

  let validation = new Validator(
    {
      id,
    },
    rules,
    error_msg
  );

  Validator.registerAsync(
    "check_business",
    async function (id, attribute, req, passes) {
      let [check, s] = await model.execute(
        `SELECT * FROM businesses WHERE id = '${id}' LIMIT 1`
      );
      if (!check.length) {
        passes(false, "Access denied. Business not found.");
      } else {
        passes();
      }
    }
  );

  validation.checkAsync(passes, fails);
  function fails() {
    let message = [];
    for (var key in validation.errors.all()) {
      var value = validation.errors.all()[key];
      message.push(value[0]);
    }
    return res.status(200).json({
      code: 401,
      status: "error",
      message: message,
      result: [],
    });
  }
  async function passes() {
    try {
      await model.execute(`
            DELETE FROM businesses WHERE id = "${id}"
        `);
      res.json({
        code: 200,
        status: "success",
        message: "success",
        result: [],
      });
    } catch (err) {
      err.message = err.message.includes("SQLState")
        ? "Query syntax error."
        : err.message;
      res.json({
        code: 400,
        status: "error",
        message: [err.message],
        result: [],
      });
    }
  }
};

exports.getBusiness = async (req, res, next) => {
  let { name, alias, sort, order, limit, price } = req.query;
  limit = limit ? limit : 20;
  sort = sort ? sort : "asc";
  order = order ? order : "id";
  let rules = {
      order: "in:id,name,alias",
      sort: "in:asc,desc",
      limit: "integer",
    },
    query;
  let check_data = { order, sort, limit };
  name ? ((check_data.name = name), (rules.name = "required")) : null;
  alias ? ((check_data.alias = alias), (rules.alias = "required")) : null;
  price
    ? ((check_data.price = price), (rules.price = "required|check_price"))
    : null;

  let error_msg = {
    required: ":attribute cannot be null",
    in: "invalid :attribute",
  };

  Validator.registerAsync(
    "check_price",
    function (price, attribute, req, passes) {
      if (price == "$" || price == "$$" || price == "$$$" || price == "$$$$") {
        passes();
      } else {
        passes(false, "Invalid price.");
      }
    }
  );

  let validation = new Validator(check_data, rules, error_msg);
  validation.checkAsync(passes, fails);
  function fails() {
    let message = [];
    for (var key in validation.errors.all()) {
      var value = validation.errors.all()[key];
      message.push(value[0]);
    }
    return res.status(200).json({
      code: 401,
      status: "error",
      message: message,
      result: [],
    });
  }

  async function passes() {
    try {
      query = `SELECT * FROM businesses`;
      name ? (query += ` WHERE name LIKE '%${name}%'`) : null;
      alias
        ? query.search("WHERE") != -1
          ? (query += ` AND alias LIKE '%${alias}%'`)
          : (query += ` WHERE alias LIKE '%${alias}%'`)
        : null;
      price
        ? query.search("WHERE") != -1
          ? (query += ` AND price = '${price}'`)
          : (query += ` WHERE price = '${price}'`)
        : null;
      query += ` ORDER BY ${order} ${sort} LIMIT ${limit}`;
      let [data, b] = await model.query(query);
      res.json({
        code: 200,
        status: "success",
        message: "success",
        result: data,
      });
    } catch (err) {
      err.message = err.message.includes("SQLState")
        ? "Query syntax error."
        : err.message;
      res.json({
        code: 400,
        status: "error",
        message: [err.message],
        result: [],
      });
    }
  }
};

exports.putBusiness = async (req, res, next) => {
  let { id } = req.query;
  let { alias, name, price } = req.body;
  let query;
  let rules = {
    id: "required|check_business",
    alias: "required",
    name: "required",
    price: "required|check_price",
  };

  let error_msg = {
    required: ":attribute cannot be null",
    in: "invalid :attribute",
  };

  Validator.registerAsync(
    "check_price",
    function (price, attribute, req, passes) {
      if (price == "$" || price == "$$" || price == "$$$" || price == "$$$$") {
        passes();
      } else {
        passes(false, "Invalid price.");
      }
    }
  );

  Validator.registerAsync(
    "check_business",
    async function (id, attribute, req, passes) {
      let [temp] = await model.query(
        `SELECT * FROM businesses WHERE id = "${id}"`
      );
      if (temp.length) {
        business = temp[0];
        passes();
      } else {
        passes(false, "Access denied.");
      }
    }
  );
  let validation = new Validator({ id, alias, name, price }, rules, error_msg);
  validation.checkAsync(passes, fails);
  function fails() {
    let message = [];
    for (var key in validation.errors.all()) {
      var value = validation.errors.all()[key];
      message.push(value[0]);
    }
    return res.status(200).json({
      code: 401,
      status: "error",
      message: message,
      result: [],
    });
  }

  async function passes() {
    try {
      query = `UPDATE businesses SET alias = '${alias}', name = '${name}', price = '${price}' WHERE id = '${id}'`;
      await model.execute(query);
      res.json({
        code: 200,
        status: "success",
        message: "success",
        result: [],
      });
    } catch (err) {
      err.message = err.message.includes("SQLState")
        ? "Query syntax error."
        : err.message;
      res.json({
        code: 400,
        status: "error",
        message: [err.message],
        result: [],
      });
    }
  }
};
