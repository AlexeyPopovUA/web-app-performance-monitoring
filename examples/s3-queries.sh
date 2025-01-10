# Get all the index.html files in the bucket

aws s3api list-objects-v2 --bucket web-perf-mon-reports --query "Contents[?ends_with(Key, 'index.html') && ! contains(Key, 'page')].[Key]" --output text

####
# reports/ExampleProject/production-main/chrome/1736521990455/index.html
# reports/ExampleProject/production-main/chrome/1736522866225/index.html
# reports/ExampleProject/production-main/chrome/1736524248392/index.html
###
