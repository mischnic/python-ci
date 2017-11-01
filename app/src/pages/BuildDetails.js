import React from "react";
import {Link} from "react-router-dom";
import "./BuildDetails.css";
import "./Build.css";

import {Loading, Errors, formatDate, formatTime, humanDate, withFetcher, strToColor, api} from "../utils.js";
import {getJWT} from "../auth.js";

const logFormatting = {
	all: [
		[">>> ", "command"],
		[">!> ", "error"]
	],
	latex:[
		[/Package [a-zA-z0-9]+ Warning:/, "warning"],
		[/^\(([a-zA-z0-9]+)\)/, "warning"],
		[/LaTeX (?:[a-zA-z]+ )?Warning:/, "warning"],
		["Overfull \\hbox", "warning"],
		["Underfull \\hbox", "warning"],
		["Latexmk: List of undefined refs and citations:", "warning"],
		[/ {2}Label `[^']+' multiply defined/, "warning"]
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
			this.load("artifacts", res=>res.json());

			let {hash} = this.props.match.params;
			if(hash === "latest"){
				hash = this.props.info.data.latest;
			}
			const c = this.props.info.data.list.findIndex((v)=> v.commit.ref === hash);
			if(this.props.info.data.list[c+1]){
				this.load(`diff/${this.props.info.data.list[c+1].commit.ref}`, res=>res.json(), "diff");
			}
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

	load(file, type=(res)=>res.text(), as=file){
		this.setState({files: {[as]: {loading: true}, ...this.state.files}});
		return this.props.fetch(this.getURL(file))
			.then(type)
			.then(res => this.setState({
					files: {
						...this.state.files,
						[as]: {
							content: res,
							loading: false,
						}
					}
				}))
			.catch(() => this.setState({
					files: {
						...this.state.files,
						[as]: {
							loading: false,
							error: true
						},
					}
				}, ))
	}

	rebuild(){
		const stop = () => {
			if(this.rebuildInterval !== null) {
				clearInterval(this.rebuildInterval);
				this.rebuildInterval = null;
			}
		};

		const checkStatus = () =>
			api(this, this.getURL("status"))
				.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
				.then(res => res.json())
				.then(({status}) => {
					if(status !== "pending"){
						stop();
						this.props.info.reload();
					}
				});

		this.props.fetch(this.getURL("build"))
			.then(res => res.text())
			.then(() => {
					this.rebuildInterval = setInterval(() => checkStatus(), 1000);
					this.props.info.reload();
				}, console.error);
	}

	render(){
		let {proj, hash} = this.props.match.params;

		if(this.props.info.data.list){
			if(hash === "latest"){
				hash = this.props.info.data.latest;
			}
			const c = this.props.info.data.list.find((v)=> v.commit.ref === hash);
			if(c){
				const logF = logFormatting[this.props.info.data.language] ? [...logFormatting["all"], ...logFormatting[this.props.info.data.language]] : logFormatting["all"];

				const {build, commit} = c;
				return (
					<div>
						<h1><Link to="." title="Go Back to List">{proj}</Link> &gt; {hash.substring(0,7)}</h1>
						<div className="buildDetails">
							<div className="details">
								<div className={`window build buildStatus ${build.status}`}>
									<div>
										<img className="avatar" alt="" style={!commit.author_avatar ? {backgroundColor: "#"+strToColor(commit.author_name)} : null} src={commit.author_avatar || null}/>{commit.author_name}<br/>
										{commit.msg}<br/>
										<a title="Open on Github" href={commit.url}>{commit.ref}</a> ({humanDate(commit.date)})<br/>
									</div>
									<div>
										<span title={formatDate(build.start)}>started {humanDate(build.start)} </span><br/>
										{build.duration ? <span>took {formatTime(build.duration)}</span> : null} <br/>
									</div>
									<div>
										<a className="button" onClick={() => this.rebuild()} style={build.status === "pending" && {pointerEvents: "none", opacity: 0.5}}>
											<i className={`fa fa-refresh ${build.status === "pending" ? "fa-spin" : ""}`} style={{marginRight: "4px"}}/>{build.status === "pending" ? "Rebuilding" : "Rebuild"}
										</a>
									</div>
								</div>
							</div>
							<div className="files">
								<div className="window artifacts">
									{
										this.state.files["artifacts"] && (
											this.state.files["artifacts"].content &&
											Object.keys(this.state.files["artifacts"].content).length > 0 ?
											<div>
												Artifacts: <br/>
												<ol>
													{
														Object.keys(this.state.files["artifacts"].content).map(v=>(
															<li key={v}><a target="_blank" href={this.getURL(v, true)}>
																{this.state.files["artifacts"].content[v]}
															</a></li>
														))
													}
												</ol>
											</div>
											: this.state.files["artifacts"].loading && <Loading/>
										)
									}
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
									{
										this.state.files["diff"] && this.state.files["diff"].content && (
											this.state.files["diff"].content.commits.length > 0 ?
											(<div>
												<a title="Compare on Github" href={this.state.files["diff"].content.diff}>Commits</a> between last build:
												<ol>
													{
														this.state.files["diff"].content.commits.map(v=>(
															<li key={v.ref}>{v.msg.split("\n")[0]} <a title="Open on Github" href={v.url}>({v.ref.substring(0,7)})</a></li>
														))
													}
												</ol>
											</div>)
											:
											(<div>
												<a title="Compare on Github" href={this.state.files["diff"].content.diff}>Compare to last build</a>
											</div>)
										)
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