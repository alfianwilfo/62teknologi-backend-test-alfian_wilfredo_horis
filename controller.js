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
      console.log(error);
    }
  }
};
