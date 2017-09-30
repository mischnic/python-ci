import React from "react";
import {Link} from "react-router-dom";
import "./BuildDetails.css";
import "./Build.css";

import {Loading, Errors, formatDate, formatTime, humanDate, withFetcher} from "../utils.js";
import {getJWT} from "../auth.js";

const logFormatting = {
	latex:[
		[">>> ", "command"],
		[/Package [a-zA-z]+ Warning:/, "warning"],
		[/^\(([a-zA-z]+)\)/, "warning"],
		[/LaTeX (?:[a-zA-z]+ )?Warning:/, "warning"],
		["Overfull \\hbox", "warning"],
		["Underfull \\hbox", "warning"]
	]
};


export default withFetcher(class BuildDetails extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			files: {}
		};

		this.rebuildInterval = null;
	}

	componentDidMount(){
		if(this.props.info.data){
			this.load("log");
		}
	}

	componentWillUnmount(){
		if(this.rebuildInterval !== null){
			clearInterval(this.rebuildInterval);
			this.rebuildInterval = null;
		}
	}

	getURL(file, query=false){
		if(file) file = "/"+file;
		return `/api/${this.props.match.params.proj}/${this.props.match.params.hash}${file}`+
				(query?`?token=${getJWT()}`:"");
	}

	load(file){
		this.setState({files: {[file]: {loading: true}, ...this.state.files}});
		return this.props.fetch(this.getURL(file))
			.then(res => res.text())
			.then(res => this.setState({
					files: {
						...this.state.files,
						[file]: {
							content: res,
							loading: false,
						}
					}
				}))
			.catch(() => this.setState({
					files: {
						...this.state.files,
						[file]: {
							loading: false,
							error: true
						},
					}
				}, ))
	}

	rebuild(){
		// const stop = () => {
		// 	if(this.rebuildInterval !== null) {
		// 		clearInterval(this.rebuildInterval);
		// 		this.rebuildInterval = null;
		// 	}
		// };

		// const checkStatus = () => 
		// 	console.log("checked") || api(this, this.getURL("status"))
		// 		.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
		// 		.then(res => res.json())
		// 		.then(({status}) => {
		// 			if(status !== "pending"){
		// 				stop();
		// 				this.props.info.reload();
		// 			} 
					
		// 		});

		this.props.fetch(this.getURL("build"))
			.then(res => res.text())
			.then(() => {
					// this.rebuildInterval = setTimeout(() => checkStatus(), 2000);
					this.props.info.reload();
				}
				, console.error);
	}

	render(){
		let {proj, hash} = this.props.match.params;

		if(this.props.info.data.list){
			if(hash === "latest"){
				hash = this.props.info.data.latest;
			}
			const c = this.props.info.data.list.find((v)=> v.commit.ref === hash);
			if(c){
				const logF = logFormatting[this.props.info.data.language];
				const {build, commit} = c;
				return (
					<div>
						<h1><Link to="." title="Go Back to List">{proj}</Link> &gt; {hash.substring(0,7)}</h1>
						<div className="buildDetails">
							<div className="details">
								<div className={`window build buildStatus ${build.status}`}>
									<div>
										<img className="avatar" alt="" src={commit.author.avatar_url}/>{commit.author.name}<br/>
										{commit.msg}<br/>
										<a href={commit.url}>{commit.ref}</a> <i className="fa fa-external-link"/> ({humanDate(commit.date)})<br/>
									</div>
									<div>
										<span title={formatDate(build.start)}>started {humanDate(build.start)} </span><br/>
										{build.duration ? <span>took {formatTime(build.duration)}</span> : null} <br/>
									</div>
									<div>
										<a className="button" onClick={() => this.rebuild()}>
											<i className={`fa fa-refresh ${build.status === "pending" ? "fa-spin" : ""}`} style={{marginRight: "4px"}}/>Rebuild
										</a>
									</div>
								</div>
							</div>
							<div className="files">
								<div className="window artifacts">
									<div>
										Artifacts: <br/>
										<ol>
											<li><a target="_blank" href={this.getURL("pdf", true)}>PDF</a></li>
										</ol>
									</div>
									{
										build.stats && build.stats.counts ? 
										( 
										(()=>{
											const letters = build.stats.counts.letters;
											const [sumc/*, text, headers, outside, headersN, floatsN, mathsI, mathsD*/] = letters.total;

											return (
											<div>
												<span>Total letters: {sumc}</span>
												<ol>
												{
													letters.chapters.map((v)=>{
														let [name, text/*, headers, captions, headersH, floatsH, inlinesH, displayedH*/] = v;
														const style = name.startsWith("Section") ? {paddingLeft: ".7em"} : null;
														return <li key={name} style={style}>{name}: {text}</li>;
													})
												}
												</ol>
											</div>);
										})()
										) : null
									}
								</div>
								<div className="window log">
									{
										this.state.files["log"] &&
										(this.state.files["log"].loading || build.status === "pending" ? <Loading opacity={0.5}/> :
											this.state.files["log"].error ? <Errors/> : 
											<pre>
											<code>
												{
												this.state.files["log"].content
													.split("\n").map((v, i) => {
														const key = logF.findIndex(e => (
															typeof e[0] === "object" ?
																(e[0].test(v)) :
																(v.indexOf(e[0]) === 0) 
														));
														return <div className={key>-1? logF[key][1] :""} key={i}>{v}</div>;
													})
												}
											</code>
											</pre>
										)
									}
								</div>
							</div>
						</div>
					</div>
				);
			}
		}
		return null;
	}

});