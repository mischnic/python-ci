import {api} from "./utils.js";

function login(username, password){
	return fetch("api/login", {
			method: "POST",
			headers: {"Accept": "application/json","Content-Type": "application/json"},
			body: JSON.stringify({username, password}) })
		.then((res)=>res.json())
		.then((res)=> {
				localStorage.setItem("jwt", res.jwt);
				localStorage.setItem("user", username);
				return res.jwt ? Promise.resolve() : Promise.reject(res);
			}, (res) => Promise.reject(res));
}

function logout(){
	localStorage.removeItem("jwt");
	localStorage.removeItem("user");
}

function getUsername(){
	return localStorage.getItem("user");
}

function isLoggedIn(check, comp){
	return true;
	// if(check){
	// 	api(comp, "/api/", {}, "text")
	// 		.then((res)=>{
	// 			if(res === "ok"){
	// 				return Promise.resolve();
	// 			}
	// 		}, (res)=>{
	// 			if(res.status === 401){
	// 				logout();
	// 			}
	// 		});
	// }
	// return localStorage.getItem("jwt");
}

function getJWT(){
	return localStorage.getItem("jwt");
}

export {login, logout, getUsername, isLoggedIn, getJWT};