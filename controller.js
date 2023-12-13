const axios = require("axios");
const model = require("./config/table");
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
        res.json({
          code: 200,
          status: "success",
          message: "success",
          result: [],
        });
        await model.execute(`COMMIT;`);
      })
      .catch(async function (error) {
        await model.execute(`ROLLBACK;`);
        console.error(error, "errorss");
      });
  } catch (error) {}
};
