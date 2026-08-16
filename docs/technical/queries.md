## CONCEPTION EXPLANATION

In some domain lib, we could observe querie classes. This is because we want to seperate what is a usecase and what is a data fetching motivate by the client (web page, mobile, etc) need. It will consist of simple interface wich will be implement in the data storage infra.

### Anatomy of a query class

Since we are using a CQRS pattern, we will have a query class for each data fetching need. The query class will be an abstract class with a single method `execute` which will take an input and return an output. The input and output types will be defined as types in the same file.

### Error handling

They wont be any error handling in the query class. If something bad happens, the query class should still match the input and output types. So we just gonna log the error and return an empty output.


### Distinction between query and usecase

If while implementing a query class, we find ourselves needing to implement some business logic, then we should create a usecase class instead. The query class should only be responsible for fetching data and returning it in the expected format.

Another things before creating an query class, we should ask ourselves if the client doesnt already have a way to get the data it needs. Maybe the data is already available in the client state.
