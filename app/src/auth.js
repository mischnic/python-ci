// import {api} from "./utils.js";

function login(username, password){
	return fetch("/api/login", {
			method: "POST",
			headers: {"Accept": "application/json","Content-Type": "application/json"},
			body: JSON.stringify({username, password}) })
		.then(function(res) {
			if(res.ok) {
				return res;
			} else return Promise.reject(res);
		})
		.then((res)=>res.text())
		.then((res)=> {
				localStorage.setItem("jwt", res);
				localStorage.setItem("user", username);
				return res ? Promise.resolve() : Promise.reject(res);
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
	return localStorage.getItem("jwt") !== null;
}

function getJWT(){
	return localStorage.getItem("jwt");
}

export {login, logout, getUsername, isLoggedIn, getJWT};