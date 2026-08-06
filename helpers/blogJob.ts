import axios from "axios";
import { AppSettings } from "../data/appSettings";
import { apiPosts } from "../data/common";
import { AppSettingsService } from "../services/appSettings.service";

const appSettings: AppSettingsService = new AppSettingsService();

export const MediumPostJob = async () => {
  try {
    const response = await getAllPost();

    const data = response;
    const getIndexxMediumPost = await appSettings.findOne({
      key: "MediumPost",
    });
    let JSONValueStr = JSON.stringify(data);

    if (
      getIndexxMediumPost?.value === undefined ||
      getIndexxMediumPost === null
    ) {
      let newAppSettings = {
        key: "MediumPost",
        value: 0,
        description: JSONValueStr,
        lastUpdatedOn: new Date(),
      } as AppSettings;
      await appSettings.create(newAppSettings);
      console.log("MediumPost Created. Called in Cron Job", new Date());
    } else {
      let res = await appSettings.updatePart(
        {
          key: "MediumPost",
        },
        {
          $set: {
            description: JSONValueStr,
            lastUpdatedOn: new Date(),
          },
        }
      );
      console.log(
        "MediumPost Updated. Called in Cron Job",
        data.length,
        new Date()
      );
      return "";
    }
  } catch (err) {
    console.log(err);
    return "";
  }

  //});
};

const RapidAPIKey = process.env.RAPIDAPI_KEY || "";

export async function getUserId(username: string) {
  const options = {
    method: "GET",
    url: `https://medium2.p.rapidapi.com/user/id_for/${username}`,
    headers: {
      "X-RapidAPI-Key": RapidAPIKey,
      "X-RapidAPI-Host": "medium2.p.rapidapi.com",
    },
  };

  try {
    let response = await axios.request(options);
    if (response.status === 200) {
      return response.data;
    } else {
      return {
        data: "",
      };
    }
  } catch (err) {
    console.log(err);
    return err;
  }
}

export async function getPosts(userId: string) {
  const options = {
    method: "GET",
    url: `https://medium2.p.rapidapi.com/user/${userId}/articles`,
    headers: {
      "X-RapidAPI-Key": RapidAPIKey,
      "X-RapidAPI-Host": "medium2.p.rapidapi.com",
    },
  };

  try {
    let response = await axios.request(options);
    if (response.status === 200) {
      return response.data;
    } else {
      return {
        data: "",
      };
    }
  } catch (err) {
    console.log(err);
    return err;
  }
}

export async function getPost(postId: string) {
  const options = {
    method: "GET",
    url: `https://medium2.p.rapidapi.com/article/${postId}`,
    headers: {
      "X-RapidAPI-Key": RapidAPIKey,
      "X-RapidAPI-Host": "medium2.p.rapidapi.com",
    },
  };
  try {
    let response = await axios.request(options);
    if (response.status === 200) {
      return response.data;
    } else {
      return {
        data: "",
      };
    }
  } catch (err) {
    console.log(err);
    return;
  }
}

export async function getAllPost() {
  const userId = await getUserId("Indexx");
  const posts = await getPosts(userId.id);
  let articles: Array<apiPosts> = [];
  for (let i = 0; i < posts.associated_articles.length; i++) {
    const post = await getPost(posts.associated_articles[i]);
    articles.push(post);
  }
  return articles;
}
