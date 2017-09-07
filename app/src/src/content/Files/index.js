import React from 'react';
import {Link, withRouter} from 'react-router-dom';

import { api } from '../../utils.js';
import {getJWT} from '../../auth.js';
import './Files.css';
import './grid.css';

import Preview from './Preview.js';

import ModalProvider, {withModals} from '../../components/Modal.js';

import cloneDeep from 'lodash/fp/cloneDeep';

Object.reduce = function(obj, callback, start){
	let acc = cloneDeep(start);

	for (let key in obj) {
		if (obj.hasOwnProperty(key)){
			acc = callback(key, obj[key], acc, obj);
		}
	}

	return acc;
};

Object.filter = function(obj, predicate){
	let result = {}, key;

	for (key in obj) {
		if (obj.hasOwnProperty(key) && !predicate(key, obj[key])) {
			result[key] = obj[key];
		}
	}

	return result;
};

if (!Array.prototype.last){
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
}

const slash = (s) => (
	s.endsWith('/') || s.length == 0 ? (s) : (s+'/')
);

const FileList =  {
	getNext(files, file, dir = 1){
		dir = Math.sign(dir);
		let index = FileList.getIndex(files, file) + dir;
		const bounds = (dir > 0) ? ((i) => (i <= files.length-1)) : ((i) => (i >= 0));
		if(bounds(index)) {
			if(files[index].hasPreview()){
				return files[index];
			} else {
				for(let i = index + dir; bounds(i); i+=dir){
					if(files[i].hasPreview()){
						return files[i];
					}
				}
			}

		}
		return false;
	},
	getIndex(files, file){
		file = typeof file === 'string' ? file : file.name;
		return files.findIndex( e => e.name == file);
	},
	exists(files, name){
		return FileList.getIndex(files, name) != -1;
	},
	sort(input){
		let files = cloneDeep(input);
		files.sort((a,b)=>{
			a = a.name.toLowerCase(), b=b.name.toLowerCase();
			if(a < b) {
				return -1;
			} else if(a > b) {
				return 1;
			}
			return 0;
		});
		return files;
	}
};


class File {
	constructor(name, mime, path){
		this.name = name;
		this.mime = mime;
		this.path = slash(path);
	}

	getPath(){
		return this.path+this.name;
	}

	getAPIPath(){
		return '/api/data/'+this.getPath();
	}

	getReqPath(){
		return this.getAPIPath()+'?token='+getJWT();
	}

	hasPreview(){
		//!this.mime.match(/application\/pdf|directory/); 
		return (this.isText() || this.isImage()) && 
				(this.mime !== 'application/pdf' && this.mime !== 'directory');
	}

	isImage(){
		return this.mime.startsWith('image/');
	}

	isText(){
		return this.mime.match(/^(text|(application\/(x-tex|javascript|x-httpd-php|x-sh)))/);
	}

	isDirectory(){
		return this.mime === 'directory';
	}
}

const Breadcrumbs = ({ path }) => {
	const folder = path.split('/').filter((v)=>(v.length>0));
	const count = folder.length + 1;

	return <span id='breadcrumbs'>{
		['Your Files', ...folder]
			.map((v,i)=>{
				const linkPath = String('../').repeat(count-i-1);
				if(i < count-1){
					return <span key={v}>
								{i > 0 ?  <span>{' > '}</span>: null}
								<Link to={linkPath} >{v}</Link>
							</span>;
				} else {
					return <span key={v}>{i > 0 ? ' > ': ''}{v}</span>;
				}
			})
	}</span>;
};

const ContextMenu = ({pos, file, hide, open, actions}) => {
	if(file){
		let preview;
		if(file.isDirectory()){
			preview = 'Open';
		} else if(file.hasPreview()){ 
			preview = 'Preview';
		}

		return 	<div id='contextmenu' style={{
						top: pos.top,
						left: pos.left 
					}}>
					<ul>
						{ preview && <li onClick={()=>{open(file);hide();}}>{preview}</li> }
						{ preview && <li/> }
						<li ><a href={file.getReqPath()} download>Download</a></li>
						<li onClick={()=>{actions.rename(file);hide();}}>Rename</li>
						<li onClick={()=>{actions.delete(file);hide();}}>Delete</li>
					</ul>
				</div>;
	} else 
		return false;
};

const Files = withModals(class Files extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			files: [],
			contextMenu: false,
			preview: null,
			fileDropping: false
		};

		this.clickListener = evt =>{
			if(this.state.contextMenu && !evt.target.closest('#contextmenu')){
				this.setState({contextMenu: false});
			}
		};
		this.keydownListener = evt =>{
			if(this.state.contextMenu && evt.key == 'Escape'){
				this.setState({contextMenu: false});
			}
			if(this.state.preview){
				if(evt.key == 'ArrowRight'){
					let n = FileList.getNext(this.state.files, this.state.preview, 1);
					if(n){
						this.setState({preview: n});
					}
				} else if(evt.key == 'ArrowLeft'){
					let n = FileList.getNext(this.state.files, this.state.preview, -1);
					if(n){
						this.setState({preview: n});
					}
				}
			}
		};
	}

	componentWillMount(){
		if(!this.props.match.url.endsWith('/')){
			this.props.history.replace(this.props.match.url+'/');
		}
	}

	componentDidMount(){
		this.refresh();
		document.addEventListener('click', this.clickListener);
		document.addEventListener('keydown', this.keydownListener);
	}

	componentWillReceiveProps(next){
		if(this.props.match.params.path !== next.match.params.path){
			this.refresh(this.getPath(next));
		}
	}

	componentWillUnmount(){
		document.removeEventListener('click', this.clickListener);
		document.removeEventListener('keydown', this.keydownListener);
	}

	getPath(p = this.props){
		return p.match.params.path ? p.match.params.path : '';
	}

	refresh(path){
		if(typeof path === 'undefined'){
			path = this.getPath();
		} else {
			this.setState({files:[]});
		}
		api(this, '/api/files/list/'+path).then((res)=>{
			if(res){
				this.setState(
					{
						files: FileList.sort(Object.reduce(res, (k,v,acc)=>{
							acc.push(new File(k,v,path));
							return acc;
						}, []))
					}
				);
			}
		});
	}

	handleClick(file){
		if(file.isDirectory()){
			const path = file.getPath()+'/';
			this.setState({files:[]},()=>{this.props.history.push(slash(location.pathname.match(/.*\/files/)[0])+path);});
		} else{
			this.setState({preview: file});
		}
	}

	handleContextMenu(evt, file){
		evt.preventDefault();
		this.setState({
			contextMenu:{
				file,
				top: (evt.pageY - document.getElementById('main').offsetTop)+'px',
				left: (evt.pageX - document.getElementById('main').offsetLeft)+'px'
			}
		});
	}

	download(file){
		console.log('download', file);
	}

	rename(file){
		this.props.showModal(
		{
			title: ({name})=>`Renaming '${name}'`,
			content: (f) => (
				<div>Please choose a new filename: {
					ModalProvider.FORMS.TEXTFIELD({
						name: 'newName', 
						onChange: (e, formHandler) => {
							let newName = e.target.value;
							if(newName.indexOf('/')!==-1){
								formHandler.vars.message = 'Filenames can\'t contain slashes!';
							} else if(FileList.exists(this.state.files, newName)){
								formHandler.vars.message = 'Please enter a different filename!';
							} else {
								formHandler.vars.message = null;
							}
						}
					})(f)}
					<span style={{color: 'red', verticalAlign: 'middle', marginLeft: '0.5em'}}>{f.vars.message}</span>
				</div>
			),
			actions: [
				{
					name: 'Cancel',
					callback: ModalProvider.ACTIONS.CANCEL,
					onHide: true
				},
				{
					name: 'Ok',
					callback: ModalProvider.ACTIONS.OK,
					onSubmit: true
				}
			]
		}, {
			name: file.name,
			success: (formHandler)=> {
				let { newName = ''} = formHandler.form;
				if(newName.length && newName.indexOf('/')==-1 && !FileList.exists(this.state.files, newName)){
					api(this, '/api/files/rename/', {body: {old: file.getPath(), new: slash(this.getPath())+newName}}, 'text').then((res)=>{
						if(res == 'ok'){
							this.refresh();
						}
					});
					return true;
				}
				return false;
			}
		});

	}

	delete(file){
		console.log('delete', file);
	}

	// showUpload(b,e){
	// 	// clearTimeout(this.fileDroppingTimeout);
	// 	// this.setState({fileDropping: true});
	// 	if(e.target == document.querySelector('.files > div')){
	// 		e.persist();
	// 		console.log(e.type,e);
	// 		this.setState({fileDropping: b});
	// 	}
	// 	//TODO listen corretly on onDragEnd/Leave only on .files
	// 	// this.fileDroppingTimeout = setTimeout(()=>{this.setState({fileDropping: false});},100);
	// }

	render() {
		let { files, contextMenu, preview} = this.state;
		return (
			<div style={{position: 'relative'}}>
				<h1>
					<Breadcrumbs path={this.getPath()}/>
					<div className='refresh' onClick={()=>this.refresh()}> <img src='/img/fb/refresh.svg'/> </div>
				</h1>
				<div id='files'
					// onDragEnter={(e)=>this.showUpload(true, e)}
					// onDragStart={(e)=>this.showUpload(true, e)}
					// onDragOver={(e)=>this.showUpload(true, e)}
					// onDrag={(e)=>this.showUpload(true, e)}
					// onDragEnd={(e)=>this.showUpload(false, e)}
					// onDragLeave={(e)=>this.showUpload(false, e)}
					// onDrop={(e)=>{e.preventDefault(); console.log(e);}} 
					>
					<div className='flex-container'>
					{ files.map((file)=>{
						let {name, mime} = file;
						let reqPath = file.getReqPath();
						let thumbnail, overlay;
						// if(ext.match(/^(png|jpe?g|svg|tiff?|gif)$/i))
						if(file.isImage()){
							thumbnail = <img onClick={()=>{this.handleClick(file);}} src={reqPath}/>;
						} else if(mime === 'directory'){
							thumbnail = <Link to={`./${name}/`}>
											<img src='/img/fb/folder.png'/>
										</Link>; // onClick={()=>{this.handleClick(name);}}
						// }else if(file.mime == "application/pdf"){ //pdf
						} else if(mime == 'application/pdf'){
							thumbnail = <a href={reqPath} target='_blank'> 
											<img src='/img/fb/pdf.png'/>
										</a>;
						// } else if(file.mime.match(/^text/)){ //text
						// } else if(ext.match(/^(css|js|tex|conf|txt|php|html|sh|csv|command|c(?:pp)?|h|md)$/i)){
						} else if(file.isText()){
							thumbnail = <img onClick={()=>{this.handleClick(file);}} src='/img/fb/text.png'/>;
							overlay = name.split('.').last();
						} else if(mime == 'application/zip'){
							thumbnail = 'zip';
						} else {
							thumbnail = '?';
						}

						if(mime == 'application/x-tex'){
							overlay = 'tex';
						} else if(file.isText() && name.indexOf('apache') != -1 && name.endsWith('.conf')){
							overlay = 'apache';
						}
						return (<div className='flex-container file' data-file={name} key={name} onContextMenu={(e)=>{this.handleContextMenu(e,file);}}>
							<div className='flex-item'>
								{
									overlay ? 
									<div className='thumbnail' data-overlay={overlay}>
										{thumbnail}
									</div>	:
									<div className='thumbnail'>
										{thumbnail}
									</div>
								}
							</div>
							<div className='flex-item'>{name}</div>
						</div>); /*{this.state.files[v]}*/
					})
					}
					</div>
					{ this.state.fileDropping && (
						<div className='dropping'>
							<div>
								Drop to upload
							</div>
						</div>
					)}
				</div>
				<ContextMenu pos={{top: contextMenu.top, left: contextMenu.left}} file={contextMenu.file} 
					hide={()=>this.setState({contextMenu: false})} open={(f)=>this.handleClick(f)} 
					actions={{download: (f)=>this.download(f), rename: (f)=>this.rename(f), delete: (f)=>this.delete(f)}}/>
				<Preview show={!!preview} hide={()=>this.setState({preview: null})} file={preview} />
			</div>
		);
	}
});

export default withRouter(Files);