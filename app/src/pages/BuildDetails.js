import React from "react";
import {Link} from "react-router-dom";
import "./BuildDetails.css";
import "./Build.css";

import {Loading, Errors, formatDate, formatTime, humanDate, withFetcher, strToColor} from "../utils.js";
import {getJWT} from "../auth.js";

const logFormatting = {
	all: [
		[">>> ", "command"],
		[">> ", "info"],
		[">! ", "info error"]
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


class Log extends React.Component{
	constructor(props){
		super(props);

		this.state = {
			lines: [],
			commands: [],
			expanded: [],
			styles: logFormatting[this.props.lang] ? [...logFormatting["all"], ...logFormatting[this.props.lang]] : logFormatting["all"]
		}
	}

	reload(){
		const lines = this.props.content
						.split("\n")
						.filter((v,i)=> v !== "")
						.map((v, i, arr) => {
							const style = this.state.styles.find(e => (
								typeof e[0] === "object" ?
									(e[0].test(v)) :
									(v.indexOf(e[0]) === 0)
							));
							return [v, style ? style[1] : null];
						});

		const commands = lines.reduce((acc, v, i)=>{
													if((v[1] || "").includes("command"))
														acc[i]=v;
													return acc;
												}, {})

		const expanded = {};

		if(!lines[lines.length-1][1] || !lines[lines.length-1][1].includes("info")){
			const cmdKeys =Object.keys(commands);
			expanded[cmdKeys[cmdKeys.length-1]] = true;
		}

		this.setState({
			lines,
			commands,
			expanded: {...this.state.expanded, ...expanded}
		});
	}

	componentDidMount(){
		this.reload();
	}

	componentDidUpdate(prevProps, prevState){
		if(this.props.content !== prevProps.content){
			this.reload();
		}
	}

	
	render() {
		return	<pre>
					<code>
						{(()=>{
						const showCollapsible = window.matchMedia("(min-width: 660px)").matches;
						let lastCommandShow = !showCollapsible;
						return this.state.lines.map(([v,style],i, arr)=>{
							if(style){
								if(showCollapsible){
									if(style === "command"){
										if(i !== arr.length-1){
											lastCommandShow = this.state.expanded[i];
											return <div onClick={(e)=> this.setState(
												{	
													expanded: {...this.state.expanded, [i]: !this.state.expanded[i]}
												})
											} className={lastCommandShow ? "command-exp" : "command-mini"} key={i}>{v}</div>;
										} else{
											return <div className="command" key={i}>{v}</div>;
										}
									} else{
										if(style.indexOf("info")>-1){
											return <div className={style} key={i}>{v.substring(3)}</div>;
										} else {
											return lastCommandShow && <div className={style} key={i}>{v}</div>;
										}
									}
								} else {
									return <div className={style} key={i}>{v}</div>;
								}
							} else {
								return lastCommandShow && <div key={i}>{v}</div>;
							}
						})
						})()}
					</code>
				</pre>
	}
}


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
			this.hash = this.props.match.params.hash;
			this.commit = this.props.info.data.list.find((v)=> v.commit.ref === this.hash);

			this.load("log");

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

	componentWillReceiveProps(nextProps){
		this.commit = nextProps.info.data.list.find((v)=> v.commit.ref === this.hash);

		if(nextProps.info.data.list.find((v)=> v.commit.ref === this.hash).build.status === "success"){
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
		return `/api/${this.props.match.params.proj}/${this.hash}${file}`+
				(query?`?token=${getJWT()}`:"");
	}

	load(file, type=(res)=>res.text(), as=file){
		this.setState({files: {...this.state.files, [as]: {loading: true}}});
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
		this.props.fetch(this.getURL("build"));
	}

	render(){
		let {proj, hash} = this.props.match.params;
		if(this.props.info.data.list){
			if(hash === "latest"){
				hash = this.props.info.data.latest;
			}

			if(this.commit){
				const {build, commit} = this.commit;
				return (
					<div>
						<h1><Link to="." title="Go Back to List">{proj}</Link> &gt; {hash.substring(0,7)}</h1>
						<div className="buildDetails">
							<div className="details">
								<div className={`window build buildStatus ${build.status}`}>
									<div>
										<img className="avatar" alt="" style={!commit.author_avatar ? {backgroundColor: "#"+strToColor(commit.author_name)} : null} src={commit.author_avatar || null}/>{commit.author_name}<br/>
										{commit.msg}<br/>
										<a title="Open on Github" href={commit.url} target="_blank">{commit.ref}</a> ({humanDate(commit.date)})<br/>
									</div>
									<div>
										<span title={formatDate(build.start)}>started {humanDate(build.start)} </span><br/>
										{build.duration ? <span>took {formatTime(build.duration)}</span> : null} <br/>
									</div>
									<div>
										<a className="button" onClick={() => this.rebuild()} style={build.status === "pending" ? {pointerEvents: "none", opacity: 0.5} : null}>
											<i className={`fa fa-refresh ${build.status === "pending" ? "fa-spin" : ""}`} style={{marginRight: "4px"}}/>{build.status === "pending" ? "Building" : "Rebuild"}
										</a>
									</div>
								</div>
							</div>
							<div className="files">
								<div className="window artifacts">
									{
										build.artifacts && 	Object.keys(build.artifacts).length > 0 &&
										<div>
											Artifacts: <br/>
											<ol>
												{
													Object.keys(build.artifacts).map(v=>(
														<li key={v}><a target="_blank" href={this.getURL(v, true)}>
															{build.artifacts[v]}
														</a></li>
													))
												}
											</ol>
										</div>
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
												<a title="Compare on Github" href={this.state.files["diff"].content.diff} target="_blank">Commits</a> between last build:
												<ol>
													{
														this.state.files["diff"].content.commits.map(v=>(
															<li key={v.ref}>{v.msg.split("\n")[0]} <a title="Open on Github" href={v.url} target="_blank">({v.ref.substring(0,7)})</a></li>
														))
													}
												</ol>
											</div>)
											:
											(<div>
												<a title="Compare on Github" href={this.state.files["diff"].content.diff} target="_blank">Compare to last build's commit</a>
											</div>)
										)
									}
								</div>
								<div className="window log">
									{
										this.state.files["log"] &&
										(this.state.files["log"].loading || build.status === "pending" ? <Loading opacity={0.5}/> :
											this.state.files["log"].error ? <Errors/> : 
											<Log lang={this.props.info.data.language} content={this.state.files["log"].content}/>
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