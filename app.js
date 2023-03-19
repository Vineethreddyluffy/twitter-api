const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
app.use(express.json());
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
  }
};

initializeDBAndServer();

const authenticate = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    await jwt.verify(jwtToken, "vineethreddy", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const userDetails = request.body;
  const { username, password, name, gender } = userDetails;
  const dbQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const hashedPass = bcrypt.hash(password, 10);
  if (dbResponse !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const dbQuery = `
            INSERT INTO user(name,username,password,gender)
            VALUES(
                '${name}',
                '${username}',
                '${hashedPass}',
                '${gender}'
            );`;
      await db.run(dbQuery);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const dbQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordSame = await bcrypt.compare(password, dbResponse.password);
    if (isPasswordSame) {
      const payLoad = {
        username: username,
      };
      const jwtToken = await jwt.sign(payLoad, "vineethreddy");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticate, async (request, response) => {
  const { username } = request;
  const dbQuery = `
    SELECT user.username,tweet.tweet,tweet.date_time AS dateTime 
    FROM user NATURAL JOIN tweet
    WHERE user.username='${username}'
    LIMIT 4;`;
  const dbResponse = await db.all(dbQuery);
  response.send(dbResponse);
});

app.get("/user/following/", authenticate, async (request, response) => {
  const { username } = request;
  const dbQuery = `
        SELECT *
        FROM user
        WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const second = `
        SELECT following_user_id
        FROM user INNER JOIN follower on user.user_id=follower.follower_id
        WHERE user.user_id=${dbResponse.user_id};`;
  const sResponse = await db.all(second);
  const newArr = sResponse.map((each) => {
    return each.following_user_id;
  });
  const Arr = newArr.join(",");
  const third = `
  SELECT name FROM user WHERE user_id IN (${Arr});`;
  const tResponse = await db.all(third);
  response.send(tResponse);
});

app.get("/user/followers/", authenticate, async (request, response) => {
  const { username } = request;
  const dbQuery = `
        SELECT *
        FROM user
        WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const second = `
        SELECT follower_user_id
        FROM user INNER JOIN follower on user.user_id=follower.follower_id
        WHERE user.user_id=${dbResponse.user_id};`;
  const sResponse = await db.all(second);
  const newArr = sResponse.map((each) => {
    return each.follower_user_id;
  });
  const Arr = newArr.join(",");
  const third = `
  SELECT name FROM user WHERE user_id IN (${Arr});`;
  const tResponse = await db.all(third);
  response.send(tResponse);
});

app.get("/tweets/:tweetId/", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const dbQuery = `
            SELECT *
            FROM user
            WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const second = `
            SELECT following_user_id
            FROM user INNER JOIN follower on user.user_id=follower.follower_id
            WHERE user.user_id=${dbResponse.user_id};`;
  const sResponse = await db.all(second);
  const newArr = sResponse.map((each) => {
    return each.following_user_id;
  });
  const tweeted = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetRes = await db.get(tweeted);
  const userTweeted = tweetRes.user_id;
  if (newArr.includes(userTweeted)) {
    const dbQuery = `
            SELECT tweet.tweet,COUNT(DISTINCT like_id) AS likes,COUNT(DISTINCT reply_id) AS replies,tweet.date_time AS dateTime 
            FROM tweet INNER JOIN like ON tweet.user_id=like.user_id INNER JOIN reply ON tweet.tweet_id=reply.tweet_id
            WHERE tweet.user_id=${userTweeted} and tweet.tweet_id=${tweetId}
            GROUP BY tweet.tweet_id;`;
    const dbResponse = await db.get(dbQuery);
    response.send(dbResponse);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get("/tweets/:tweetId/likes/", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const dbQuery = `
            SELECT *
            FROM user
            WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const second = `
            SELECT following_user_id
            FROM user INNER JOIN follower on user.user_id=follower.follower_id
            WHERE user.user_id=${dbResponse.user_id};`;
  const sResponse = await db.all(second);
  const newArr = sResponse.map((each) => {
    return each.following_user_id;
  });
  const tweeted = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetRes = await db.get(tweeted);
  const userTweeted = tweetRes.user_id;
  if (newArr.includes(userTweeted)) {
    const dbQuery = `SELECT *
    FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id
    WHERE tweet.tweet_id=${tweetId}`;
    const dbResponse = await db.all(dbQuery);
    const newArr = dbResponse.map((each) => {
      return each.user_id;
    });
    const Arr = newArr.join(",");
    const second = `SELECT *
    FROM user WHERE user_id IN (${Arr});`;
    const sResponse = await db.all(second);
    const secondArr = sResponse.map((each) => {
      return each.username;
    });
    response.send({ likes: secondArr });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/replies/",
  authenticate,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const dbQuery = `
            SELECT *
            FROM user
            WHERE username='${username}';`;
    const dbResponse = await db.get(dbQuery);
    const second = `
            SELECT following_user_id
            FROM user INNER JOIN follower on user.user_id=follower.follower_id
            WHERE user.user_id=${dbResponse.user_id};`;
    const sResponse = await db.all(second);
    const newArr = sResponse.map((each) => {
      return each.following_user_id;
    });
    const tweeted = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
    const tweetRes = await db.get(tweeted);
    const userTweeted = tweetRes.user_id;
    if (newArr.includes(userTweeted)) {
      const dbQuery = `SELECT *
    FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id
    WHERE tweet.tweet_id=${tweetId}`;
      const dbResponse = await db.all(dbQuery);
      const newArr = dbResponse.map((each) => {
        return each.user_id;
      });
      const Arr = newArr.join(",");
      const second = `SELECT *
    FROM user NATURAL JOIN reply WHERE user_id IN (${Arr}) and reply.tweet_id=${tweetId};`;
      const sResponse = await db.all(second);
      const secondArr = sResponse.map((each) => {
        return {
          name: each.name,
          reply: each.reply,
        };
      });
      response.send({ replies: secondArr });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authenticate, async (request, response) => {
  const { username } = request;
  const dbQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const second = `SELECT tweet,COUNT(DISTINCT like.like_id) AS likes,COUNT(DISTINCT reply.reply_id) AS replies,date_time AS dateTime
  FROM user NATURAL JOIN tweet AS table1 INNER JOIN reply ON table1.tweet_id=reply.tweet_id 
  INNER JOIN like ON table1.tweet_id=like.tweet_id
  WHERE user.user_id=${dbResponse.user_id}
  GROUP BY table1.tweet_id;`;
  const sResponse = await db.all(second);
  response.send(sResponse);
});

app.post("/user/tweets/", authenticate, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const dbQuery = `SELECT *
    FROM user
    WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const second = `INSERT INTO tweet(tweet)
  VALUES(
      '${tweet}'
  );`;
  await db.run(second);
  response.send("Created a Tweet");
});

app.delete("/tweets/:tweetId/", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const dbQuery = `SELECT *
    FROM user
    WHERE username='${username}';`;
  const dbResponse = await db.get(dbQuery);
  const second = `
  SELECT *
  FROM tweet
  WHERE tweet_id=${tweetId}`;
  const sResponse = await db.get(second);
  if (dbResponse.user_id === sResponse.user_id) {
    const dbQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
    await db.run(dbQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
