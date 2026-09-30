import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import moment from "moment";


export interface IBookListRequest {
    Title: string;
    AuthorName: string;
    ISBN: string;
    PageSize: number;
    PageIndex: number;
    SortBy?: string;
    SortDirection?: number;
    SearchKey: string;
    statuscode: null | number;
    subjectid?: null | number;
    printyear?: null | number;
}
export interface IBookItem {
    id: number;
    title: string;
    authorName: string;
    isbn: string;
    nationalDepositoryNo: null | string;
    versionNumber: number | null;
    printYear: number | null;
    isApproved: number;
    status: string; language: string[];
    numberOfCopies: number;
    subjectId: number | null;
    subjectNameEn: null | string;
    subjectNameAr: null | string;
    updatedOn: null | string;
}

export interface IBookListResponse {
    totalPage: number;
    totalItems: number;
    totalAmount: number;
    itemsPerPage: number;
    currentPage: number;
    items: IBookItem[];
}

export function getBookList(data: IBookListRequest) {
    return request.get<IBookListResponse>('/api/ContentLibrary/GetBookList', data);
}

export interface IBookCountResponse {
    _approveCount: number;
    _rejectCount: number;
    _peddingCount: number;
    total: number;
}
export function getBooksCount(){
    return request.get<IBookCountResponse>('/api/ContentLibrary/GetBooksCount');
}

interface IChangeBookStatusRequest{
    bookId: number;
    status: number;
    attachmentsURL: string;
    notes: string;
}
export function postChangeBookStatus(data: IChangeBookStatusRequest){
    return request.post(`/api/ContentLibrary/ChangeBookStatus`, data);
}
export interface IBookDetailsResponse{
    id: number;
    title: string;
    authorName: string;
    isbn: string;
    nationalDepositoryNo: null | string;
    versionNumber: number;
    subjectId: number;
    printYear: number;
    isApproved: number;
    status: string;
    subjectNameAr: string;
    subjectNameEn: string;
    subjectSubCategoryNameAr: string;
    subjectSubCategoryNameEn: string;
    language: string[];
    numberOfCopies: number;
    bookAppsInfo: any[];
}
export function getBookDetailsById(bookid:number){
    return request.get<IBookDetailsResponse>('/api/ContentLibrary/GetBookDetailsById', { bookid });
}

export interface IGetHistoryListResponse{
    id: number;
    applicationNum: null | string;
    bookId: number;
    approverId: string;
    approverName: null | string;
    approverDate: string;
    approvalStatus: number;
    applicationId: null | number;
    nodeName: string;
}
export function getHistoryList(bookid: number){
    return request.get<IGetHistoryListResponse[]>(`/api/ContentLibrary/GetHistoryList/${bookid}`);
}
export interface IBookAppsInfoListRequest{
    KeyWord: string;
    bookid: string;
    PageSize: number;
    PageIndex: number;
    SortBy: string;
    SortDirection: number;
    SubmissionTimeFr: string;
    SubmissionTimeTo: string;
}
export interface IBookAppsInfoListItem{
    bookId: number;
    applicationNumber: string;
    serviceNameEn: string;
    serviceNameAr: string;
    appStatusAr: string;
    appStatusEn: string;
    applyFor: string;
    submissionTime: string;
    userTypeCode: string;
    userTypeName: string;
    appStatusId: number;
}
export interface IBookAppsInfoListResponse{
    pageIndex: number;
    pageSize: number;
    total: number;
    items: IBookAppsInfoListItem[]
}
export function getBookAppsInfoListById(data: IBookAppsInfoListRequest){
    return request.get<IBookAppsInfoListResponse>(`/api/ContentLibrary/GetBookAppsInfoListById`, data);
}

export function getContentLibraryExportCSV(fileName: string, params: IBookListRequest){
    return saveFileWithAxios("/api/ContentLibrary/ExportCSV", fileName, params);
}
interface INewspaperItems{
    id: number;
    type: string;
    titles: string[];
    periodicalTypeEn: string;
    periodicalTypeAr: string;
    subjectCategoryEn: string[];
    subjectCategoryAr: string[];
    languageEn: string[];
    languageAr: string[];
    copies: number;
    status: string;
    statuscode: number;
    createdOn: string;
    updatedOn: null | string;
}
export interface INewspaperListResponse{
    totalPage: number;
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    totalAmount: number;
    items: INewspaperItems[];
}
export interface INewspaperListRequest{
    SearchKey?: string;
    periodicaltypeid?: number;
    subjectcategoryid?: number;
    statuscode?: number;
    PageSize?: number;
    PageIndex?: number;
    SortBy?: string;
    SortDirection?: number;
}
export function getNewspaperList(data?: INewspaperListRequest){
    return request.get<INewspaperListResponse>('/api/ContentLibrary/GetNewspaperList', data);
}
export interface INewsPapersCountResponse{
    total: number;
    _approveCount: number;
    _rejectCount: number;
    _peddingCount: number;
}
export function getNewsPapersCount(){
    return request.get<INewsPapersCountResponse>('/api/ContentLibrary/GetNewsPapersCount');
}
interface INewspaperDetailsRequest{
    newspaperid: string;
}
export interface INewspaperTitle{
    key: string;
    value: string;
}
export interface INewspaperDetailsResponse{
    id: number;
    type: string;
    titles: INewspaperTitle[];
    periodicalTypeEn: string;
    periodicalTypeAr: string;
    subjectCategoryEn: string[];
    subjectCategoryAr: string[];
    languageEn: string[];
    languageAr: string[];
    copies: number;
    status: string;
    statuscode: number;
    createdOn: string;
    publishingHouse: string;
    lastVersionNumber: string;
}
export function getNewspaperDetailsById(data: INewspaperDetailsRequest){
    return request.get<INewspaperDetailsResponse>('/api/ContentLibrary/GetNewspaperDetailsById', data)
}
export interface INewspaperAppsInfoListRequest{
    KeyWord?: string;
    newspaperid?: string | null;
    SubmissionTimeFr?: string;
    SubmissionTimeTo?: string;
    PageSize?: number;    
    PageIndex?: number;
    SortBy?: string;
    SortDirection?: number;
}
interface NewspaperAppItem{
    newsPaperId: number;
    applicationNumber: string;
    serviceNameEn: string;
    serviceNameAr: string;
    appStatusId: number;
    appStatusAr: string;
    appStatusEn: string;
    userTypeCode: string;
    userTypeName: string;
    applyFor: string;
    submissionTime: string;
}
export interface INewspaperAppsInfoListResponse{
    totalPage: number;
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    totalAmount: number;
    items: NewspaperAppItem[];
}
export function getNewspaperAppsInfoListById(data: INewspaperAppsInfoListRequest){
    return request.get<INewspaperAppsInfoListResponse>('/api/ContentLibrary/GetNewspaperAppsInfoListById', data);
}
export interface INewspaperStatusHistoryListResponse{
    id: number;
    applicationNum: string;
    newspapeId: number;
    approverId: string;
    approverName: string;
    approverDate: string;
    approvalStatus: number;
    applicationId: number;
    nodeName: string;
}
export function getNewspaperStatusHistoryList(id: string){
    return request.get<INewspaperStatusHistoryListResponse[]>(`/api/ContentLibrary/GetNewspaperStatusHistoryList/${id}`)
}
export interface IGetCinemaStatusHistoryListResponse{
    id: number;
    applicationNum: string;
    cinemaId: number;
    approverId: string;
    approverName: string;
    approverDate: string;
    approvalStatus: number;
    applicationId: number;
    nodeName: string;
}
export function getCinemaStatusHistoryList(id: string){
    return request.get<INewspaperStatusHistoryListResponse[]>(`/api/ContentLibrary/GetCinemaStatusHistoryList/${id}`)
}
export interface IGetVideoGamesStatusHistoryListResponse{
    id: number;
    applicationNum: string;
    videoGamesId: number;
    approverId: string;
    approverName: string;
    approverDate: string;
    approvalStatus: number;
    applicationId: number;
    nodeName: string;
}
export function getVideoGamesStatusHistoryList(id: string){
    return request.get<INewspaperStatusHistoryListResponse[]>(`/api/ContentLibrary/GetVideoGamesStatusHistoryList/${id}`)
}
interface ICinemasCountResponse{
    total: number;
    _approveCount: number;
    _rejectCount: number;
    _peddingCount: number;
}
export function getCinemasCount(){
    return request.get<ICinemasCountResponse>('/api/ContentLibrary/GetCinemasCount');
}
interface ICinemaListItem{
    id: number;
    title: string;
    artistWorkTypeId: number;
    typeNameEn: string;
    typeNameAr: string;
    languageEn: string[];
    languageAr: string[];
    writer: string;
    director: string;
    durationInMinutes: number;
    sourceCountryId: number;
    copyrightsTypeId: number;
    copyrightsTypeNameAr: string;
    copyrightsTypeNameEn: string;
    cinemaPermitTypeId: number;
    isApproved: number;
    createdOn: string;
    updatedOn: null | string;
    statuscode: number;
    status: string;
}
export interface ICinemaListResponse{
    totalPage: number;
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    totalAmount: number;
    items: ICinemaListItem[];
}
export interface ICinemaListRequest{
    SearchKey: string;
    artistworktypeid: number;
    copyrightstypeid: number;
    statuscode: number;
    PageSize: number;
    PageIndex: number;
    SortBy: string;
    SortDirection: number;
}
export function getCinemaList(data: Partial<ICinemaListRequest>){
    return request.get<ICinemaListResponse>('/api/ContentLibrary/GetCinemaList', data);
}
export interface ICinemaDetails{
    id: number;
    title: string;
    artistWorkTypeId: number;
    typeNameEn: string;
    typeNameAr: string;
    languageEn: string[];
    languageAr: string[];
    writer: string;
    director: string;
    durationInMinutes: number;
    sourceCountryId: number;
    copyrightsTypeId: number;
    copyrightsTypeNameAr: string;
    copyrightsTypeNameEn: string;
    ageRatingAr: string;
    ageRatingEn: string;
    isApproved: number;
    createdOn: string;
    sourceCode: number;
    statuscode: number;
    status: string;
    source: string;
}
export function getCinemaDetailsById(data: { cinemaid: string }){
    return request.get<ICinemaDetails>('/api/ContentLibrary/GetCinemaDetailsById', data);
}
interface CinemaApplicationItem {
  cinemaId: number;
  applicationNumber: string;
  serviceNameEn: string;
  serviceNameAr: string;
  appStatusId: number;
  appStatusAr: string;
  appStatusEn: string;
  userTypeCode: string;
  userTypeName: string;
  applyFor: string;
  submissionTime: string;
}

export interface ICinemaAppsInfoListResponse{
    totalPage: number;
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    totalAmount: number;
    items: CinemaApplicationItem[];
}
export interface ICinemaAppsInfoListRequest{
    KeyWord?: string;
    cinemaid?: string;
    SubmissionTimeFr?: string;
    SubmissionTimeTo?: string;
    PageSize?: number;
    PageIndex?: number;
    SortBy?: string;
    SortDirection?: number;
}
export function getCinemaAppsInfoListById(data: ICinemaAppsInfoListRequest){
    return request.get<ICinemaAppsInfoListResponse>('/api/ContentLibrary/GetCinemaAppsInfoListById', data);
}

export interface IVideoGamesListRequest{
    SearchKey?: string;
    artistworktypeid?: number;
    versiontype?: number;
    statuscode?: number;
    PageSize?: number;
    PageIndex?: number;
    SortBy?: string;
    SortDirection?: number;
}
interface VideoGamesItem{
    id: number;
    title: string;
    artistWorkTypeId: number;
    typeNameEn: string;
    typeNameAr: string;
    languageEn: string[];
    languageAr: string[];
    sourceCountryId: number;
    copyrightsTypeId: number;
    copyrightsTypeNameAr: string;
    copyrightsTypeNameEn: string;
    isApproved: number;
    createdOn: string;
    updatedOn: null | string;
    statuscode: number;
    status: string;
}
export interface IVideoGamesListResponse{
    totalPage: number;
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    totalAmount: number;
    items: VideoGamesItem[];
}

export const getVideoGamesList = (data: IVideoGamesListRequest) => {
    return request.get<IVideoGamesListResponse>('/api/ContentLibrary/GetVideoGamesList', data)
}

export interface IVideoGamesCountResponse{
    total: number;
    _approveCount: number;
    _rejectCount: number;
    _peddingCount: number;
}
export const getVideoGamesCount = () => {
    return request.get<IVideoGamesCountResponse>('/api/ContentLibrary/GetVideoGamesCount')
}
interface IVideoGamesDetailsRequest{
    videoGamesid: string;
}
export interface IVideoGamesDetailsResponse{
    id: number;
    title: string;
    artistWorkTypeId: number;
    typeNameEn: string;
    typeNameAr: string;
    languageEn: string[];
    languageAr: string[];
    sourceCountryId: number;
    copyrightsTypeId: number;
    copyrightsTypeNameAr: string;
    copyrightsTypeNameEn: string;
    isApproved: number;
    createdOn: string;
    statuscode: number;
    status: string;
    platformAr: string;
    platformEn: string;
    ageRatingAr: string;
    ageRatingEn: string;
}
export const getVideoGamesDetailsById = (data: IVideoGamesDetailsRequest) => {
    return request.get<IVideoGamesDetailsResponse>('/api/ContentLibrary/GetVideoGamesDetailsById', data)
}

export interface IVideoGamesAppsInfoListRequest{
    KeyWord?: string;
    videoGamesid?: string;
    SubmissionTimeFr?: string;
    SubmissionTimeTo?: string;
    PageSize?: number;
    PageIndex?: number;
    SortBy?: string;
    SortDirection?: number;
}
interface VideoGamesApplicationItem {
  videoGamesId: number;
  applicationNumber: string;
  serviceNameEn: string;
  serviceNameAr: string;
  appStatusId: number;
  appStatusAr: string;
  appStatusEn: string;
  userTypeCode: string;
  userTypeName: string;
  applyFor: string;
  submissionTime: string;
}
export interface IVideoGamesAppsInfoListResponse{
    totalPage: number;
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    totalAmount: number;
    items: VideoGamesApplicationItem[];
}
export function getVideoGamesAppsInfoListById(data: IVideoGamesAppsInfoListRequest){
    return request.get<IVideoGamesAppsInfoListResponse>('/api/ContentLibrary/GetVideoGamesAppsInfoListById', data);
}

interface IChangeNewspaperStatusRequest{
    newspapeId: number; 
    status: number;
    attachmentsURL: string;
    notes: string;
}
export function postChangeNewspaperStatus(data: IChangeNewspaperStatusRequest) {
    return request.post(`/api/ContentLibrary/ChangeNewspaperStatus`, data);
}
interface IChangeCinemaStatusRequest{
    cinemaId: number; 
    status: number;
    attachmentsURL: string;
    notes: string;
}
export function postChangeCinemaStatus(data: IChangeCinemaStatusRequest) {
    return request.post(`/api/ContentLibrary/ChangeCinemaStatus`, data);
}

interface IChangeVideoGamesStatusRequest{
    videoGamesId: number; 
    status: number;
    attachmentsURL: string;
    notes: string;
}
export function postChangeVideoGamesStatus(data: IChangeVideoGamesStatusRequest) {
    return request.post(`/api/ContentLibrary/ChangeVideoGamesStatus`, data);
}

export function getNewspaperExportCSV(params: INewspaperListRequest){
  return saveFileWithAxios("/api/ContentLibrary/NewspaperExportCSV", 'NewsPaperExport.csv', params);
}

export function getCinemaExportCSV(params: Partial<ICinemaListRequest>){
  return saveFileWithAxios("/api/ContentLibrary/CinemaExportCSV", 'CinemaExport.csv', params);
}

export function getVideoGamesExportCSV(params: IVideoGamesListRequest){
  return saveFileWithAxios("/api/ContentLibrary/VideoGamesExportCSV", 'VideoGamesExport.csv', params);
}

export interface IRegulateEntryItemFilters {
  SearchKey?: string;
  materialtypeCode?: string;
  languageid?: number;
  statuscode?: number;
  CreatedOnFr?: string;
  CreatedOnTo?: string;
}

export interface MaterialTypeLookupDto {
  nameEn?: string;
  nameAr?: string;
  code?: string;
}

export interface IRegulateEntryItemListRequest extends IRegulateEntryItemFilters {
  PageIndex: number;
  PageSize: number;
  SortBy: string;
  SortDirection: "Ascending" | "Descending";
}

export interface IRegulateEntryItem {
  id?: number | string;
  title?: string;
  hsCode?: string;
  materialTypeNameEn?: string;
  materialTypeNameAr?: string;
  language?: string[];
  numberOfTitles?: number;
  status?: "Approved" | "Rejected" | string;
  statusCode?: number;
  createdOn?: string;
}

export interface IRegulateEntryItemListResponse {
  items?: IRegulateEntryItem[];
  totalItems?: number;
  pageIndex?: number;
  pageSize?: number;
}

export interface IRegulateEntryItemsCountResponse {
  total?: number;
  approved?: number;
  rejected?: number;
}

export function getRegulateEntryItemList(data: IRegulateEntryItemListRequest) {
  return request.get<IRegulateEntryItemListResponse>(
    "/api/ContentLibrary/GetRegulateEntryItemList",
    data,
  );
}

export function getMaterialTypeLookup() {
  return request.get<MaterialTypeLookupDto[]>(
    "/api/ContentLibrary/GetMaterialTypeLookup",
  );
}

export function getRegulateEntryItemsCount(data?: IRegulateEntryItemFilters) {
  return request.get<IRegulateEntryItemsCountResponse>(
    "/api/ContentLibrary/GetRegulateEntryItemsCount",
    data,
  );
}

export function exportRegulateEntryItemList(data: IRegulateEntryItemFilters) {
  return saveFileWithAxios(
    "/api/ContentLibrary/ExportRegulateEntryItemList",
    "RegulateEntryItems.csv",
    data,
  );
}

export interface IBlockedAuthorListRequest {
  PageIndex: number;
  PageSize: number;
  SearchKey?: string;
  SortDirection: "Ascending" | "Descending";
}

export interface IBlockedAuthor {
  id: number;
  authorNameAr: string;
  authorNameEn: string;
  notes: string | null;
  createdOn: string;
}

export interface IBlockedAuthorListResponse {
  items: IBlockedAuthor[];
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  totalPage: number;
  totalAmount: number;
}

export interface IBlockedAuthorPayload {
  authorNameAr: string;
  authorNameEn: string;
  notes: string | null;
}

export interface IUpdateBlockedAuthorPayload extends IBlockedAuthorPayload {
  id: number;
}

export function getBlockedAuthorList(data: IBlockedAuthorListRequest) {
  return request.get<IBlockedAuthorListResponse>(
    "/api/ContentLibrary/GetBlockedAuthorList",
    data,
  );
}

export function addBlockedAuthor(data: IBlockedAuthorPayload) {
  return request.post<boolean>(
    "/api/ContentLibrary/AddBlockedAuthor",
    data,
  );
}

export function updateBlockedAuthor(data: IUpdateBlockedAuthorPayload) {
  return request.put<boolean>(
    "/api/ContentLibrary/UpdateBlockedAuthor",
    data,
  );
}

export function deleteBlockedAuthor(id: number) {
  return request.delete<boolean>(
    `/api/ContentLibrary/DeleteBlockedAuthor?id=${id}`,
  );
}
